import 'abortcontroller-polyfill';

import { JSONCandidate, camelCaseObject, convertJsonKeys } from '@mj-studio/js-util';

import { constructUriWithQueryParams } from './constructUriWithQueryParams';

declare const global;
const AbortController = global.AbortController;

export type RestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Header = { [P in string]: string } & {
  'Content-Type'?: ContentType;
  Accept?: ContentType;
  Authorization?: string;
};

export type ReactNativeFile = {
  key: string;
  file: {
    name: string;
    uri: string;
    type: string;
  };
};

export type ContentType =
  | 'application/json'
  | 'application/x-www-form-urlencoded;charset=UTF-8'
  | 'multipart/form-data';

export type RequestOptions<ResponseData> = {
  queryParams?: object;
  body?: object | URLSearchParams;
  files?: ReactNativeFile[];
  headers?: Header;
  serializedNames?: { [P in string]: string };
  interceptor?: (json: any) => ResponseData;
  mock?: ResponseData;
  enableMock?: boolean;
};

export type Call = () => void;
export type CallPromise<ResponseData> = () => Promise<ResponseData>;
export type Unsubscribe = () => void;
export type ApiResult<ResponseData = {}> = [CallPromise<ResponseData>, Unsubscribe];

function withTimeout<T>(ms, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise((resolve, reject) =>
      setTimeout(() => {
        reject(new Error('Timeout Error'));
      }, ms),
    ),
  ]) as Promise<T>;
}

export type RequestOptionsInterceptor<ResponseData> = (
  request: RequestOptions<ResponseData>,
  meta: { url: string; method: RestMethod; timout: number; baseUrl: string },
) => Promise<RequestOptions<ResponseData>>;

type ResponseDataInterceptorAddOnNames = 'CAMELCASE';

export const ResponseInterceptorAddOn: { [P in ResponseDataInterceptorAddOnNames]: ResponseDataInterceptor<{}> } = {
  CAMELCASE: async (response) => {
    return camelCaseObject(response);
  },
};

export type ResponseDataInterceptor<ResponseData extends JSONCandidate> = (
  responseData: ResponseData,
  statusCode: number,
  url: string,
  method: RestMethod,
) => Promise<ResponseData>;

export type ErrorInterceptorParams = { error: any; statusCode?: number; url: string; body: any; queryParams: any };
export type ErrorInterceptor = (params: ErrorInterceptorParams) => any;

export type Settings<ResponseData extends JSONCandidate> = {
  headers: Header;
  baseUrl: string;
  timeout: number;
  errorInterceptor: ErrorInterceptor;
  requestInterceptor: RequestOptionsInterceptor<ResponseData>;
  responseInterceptor: ResponseDataInterceptor<ResponseData>;
  responseInterceptorAddons: ResponseDataInterceptor<ResponseData>[];
  responseCodeWhiteListRange: { minInclude: number; maxExclude: number };
  responseCodeWhiteList: number[];
  responseCodeBlackList: number[];
  serializedNames: Record<string, string>;
};

const initialSettings: Settings<{}> = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  baseUrl: '',
  timeout: 5000,
  errorInterceptor: ({ error }) => error,
  requestInterceptor: (request) => Promise.resolve(request),
  responseInterceptor: (response) => Promise.resolve(response),
  responseInterceptorAddons: [],
  responseCodeWhiteListRange: { minInclude: 200, maxExclude: 300 },
  responseCodeWhiteList: [],
  responseCodeBlackList: [],
  serializedNames: {},
};
let settings = initialSettings;
export function setApiDefaultSettings(options: Partial<typeof settings>): void {
  settings = { ...initialSettings, ...options };
}
export function clearApiDefaultSettings(): void {
  settings = initialSettings;
}
export function getApiDefaultSettings(): Partial<typeof settings> {
  return settings;
}

/**
 * The method for uploading files to api server.
 * This method won't be used from external modules
 *
 * Note: **the properties in body object will be casted to string**
 * because of Content-Type is fixed with multipart/form-data
 *
 * @see https://dev.to/getd/x-www-form-urlencoded-or-form-data-explained-in-2-mins-5hk6
 */
function upload(
  uri: string,
  requestInit: RequestInit,
  files: ReactNativeFile[] = [],
  body: object = {},
): Promise<Response> {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, JSON.stringify(value));
  });

  Object.entries(files).forEach(([key, file]) => {
    formData.append(key, file);
  });

  requestInit.headers && (requestInit.headers['Content-Type'] = 'multipart/form-data');
  requestInit.body = formData;

  return fetch(uri, requestInit);
}

function requestFormUrlEncoded(
  uri: string,
  requestInit: RequestInit,
  body?: object | URLSearchParams,
): Promise<Response> {
  let encodedBody = new URLSearchParams();

  if (body instanceof URLSearchParams) {
    encodedBody = body;
  } else if (body) {
    Object.entries(body).forEach(([key, value]) => {
      encodedBody.set(encodeURIComponent(key), encodeURIComponent(value));
    });
  }

  requestInit.headers && (requestInit.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (!/GET/i.test(requestInit.method!)) requestInit.body = encodedBody;
  return fetch(uri, requestInit);
}

function requestJson(uri: string, requestInit: RequestInit, body?: object): Promise<Response> {
  requestInit.headers && (requestInit.headers['Content-Type'] = 'application/json');
  body && (requestInit.body = JSON.stringify(body));
  return fetch(uri, requestInit);
}

function request<ResponseData = {}>(
  method: RestMethod,
  url: string,
  options: RequestOptions<ResponseData> = { headers: settings.headers },
): ApiResult<ResponseData> {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;

  options.headers = options.headers || settings.headers;

  const optionsPromiseThunk = () =>
    settings.requestInterceptor(options, {
      baseUrl: settings.baseUrl,
      url: url,
      timout: settings.timeout,
      method: method,
    });

  const callPromise: CallPromise<ResponseData> = () =>
    withTimeout(settings.timeout, optionsPromiseThunk()).then(async (options) => {
      try {
        const { queryParams, body, files, headers, serializedNames, interceptor, mock, enableMock } = options;

        if (enableMock) {
          return mock;
        }

        const constructedUri = constructUriWithQueryParams(url, queryParams, settings.baseUrl);

        const requestInitWithoutBody: RequestInit = {
          headers: headers,
          method: method,
          signal: abortSignal,
        };

        let responsePromise: Promise<Response>;

        if (headers?.['Content-Type'] === 'multipart/form-data' || (method === 'POST' && files)) {
          responsePromise = upload(constructedUri, requestInitWithoutBody, files, body);
        } else if (
          headers?.['Content-Type'] === 'application/x-www-form-urlencoded;charset=UTF-8' ||
          body instanceof URLSearchParams
        ) {
          responsePromise = requestFormUrlEncoded(constructedUri, requestInitWithoutBody, body);
        } else {
          responsePromise = requestJson(constructedUri, requestInitWithoutBody, body);
        }

        const response = await responsePromise;

        const { status: statusCode } = response;
        const { minInclude: min, maxExclude: max } = settings.responseCodeWhiteListRange;
        const whiteList = settings.responseCodeWhiteList;
        const blackList = settings.responseCodeBlackList;

        if ((statusCode < min || statusCode >= max) && !whiteList.includes(statusCode)) {
          throw {
            error: new Error(
              // eslint-disable-next-line max-len
              `Status Code [${statusCode}] doesn't exist in responseCodeWhiteListRange [${min}, ${max}). If you want to include ${statusCode} to white list, use responseCodeWhiteList settings in setApiDefaultSettings()`,
            ),
            body,
            queryParams,
            url,
            statusCode,
          };
        } else if (blackList.includes(statusCode)) {
          throw {
            error: new Error(`Status Code [${statusCode}] exists in responseCodeBlackList [${blackList}]`),
            body,
            queryParams,
            url,
            statusCode,
          };
        }

        let responseData: any = {};

        try {
          const contentType = response.headers.get('Content-Type') || '';

          if (contentType.includes('text') && (await response.text()).length) {
            throw new Error(`response content-type is not application/json, value: ${contentType}`);
          }

          if (contentType.includes('application/json')) {
            responseData = await response.json();
          }
        } catch (e) {
          throw {
            error: e,
            body,
            queryParams,
            url,
            statusCode,
          };
        }

        const mergedSerializedNames = { ...settings.serializedNames, ...serializedNames };
        if (Object.keys(mergedSerializedNames).length) {
          responseData = convertJsonKeys(responseData, mergedSerializedNames);
        }

        if (interceptor) {
          responseData = interceptor(responseData as any);
        }

        try {
          responseData = await settings.responseInterceptor(responseData, statusCode, url, method);
        } catch (e) {
          throw {
            error: e,
            body,
            queryParams,
            url,
            statusCode,
          };
        }

        // AddOns
        for (const addOn of settings.responseInterceptorAddons) {
          responseData = await addOn(responseData, statusCode, url, method);
        }

        return responseData;
      } catch (e) {
        if (typeof e.url === 'string') {
          const { error, body, queryParams, url, statusCode } = e;
          throw settings.errorInterceptor({
            error: error,
            body,
            queryParams,
            url,
            statusCode,
          });
        } else {
          throw settings.errorInterceptor({
            error: e,
            body: 'Unknown Error',
            queryParams: 'Unknown Error',
            url: 'Unknwon Error',
          });
        }
      }
    }) as any;

  return [
    callPromise,
    (): void => {
      abortController.abort();
    },
  ];
}

export default request;
