import { JSONCandidate, convertJsonKeys } from '@mj-studio/js-util';

import { constructUriWithQueryParams } from './constructUriWithQueryParams';

export type RestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
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
  interceptor?: (json: any) => ResponseData;
  mock?: ResponseData;
  mockError?: any;
  enableMock?: boolean;
  baseUrl?: string;
  meta?: any;
  useRawUrl?: boolean;
  credentials?: RequestCredentials_;
};

export type Unsubscribe = () => void;
export type ApiResult<ResponseData = any> = Promise<ResponseData>;

export type RequestOptionsInterceptor<ResponseData extends JSONCandidate> = (
  request: RequestOptions<ResponseData>,
  meta: { url: string; method: RestMethod; baseUrl: string },
) => Promise<RequestOptions<ResponseData>>;

export type ResponseDataInterceptor<ResponseData extends JSONCandidate> = (
  responseData: ResponseData,
  statusCode: number,
  url: string,
  method: RestMethod,
  meta?: any,
) => Promise<ResponseData>;

export type ErrorInterceptorParams = { error: any; statusCode?: number; url?: string; body?: any; queryParams?: any };
export type ErrorInterceptor = (params: ErrorInterceptorParams) => any;

export type Settings<ResponseData extends JSONCandidate> = {
  headers: Header;
  baseUrl: string;
  errorInterceptor: ErrorInterceptor;
  requestInterceptor: RequestOptionsInterceptor<ResponseData>;
  responseInterceptor: ResponseDataInterceptor<ResponseData>;
  responseCodeWhiteListRange: { minInclude: number; maxExclude: number };
  responseCodeWhiteList: number[];
  responseCodeBlackList: number[];
  serializedNames: Record<string, string>;
  credentials?: RequestCredentials_;
};

const initialSettings: Settings<any> = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  baseUrl: '',
  errorInterceptor: ({ error }) => error,
  requestInterceptor: (request) => Promise.resolve(request),
  responseInterceptor: (response) => Promise.resolve(response),
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

  if (!/GET/i.test(requestInit.method!)) {
    requestInit.body = encodedBody;
  }

  return fetch(uri, requestInit);
}

function requestJson(uri: string, requestInit: RequestInit, body?: object): Promise<Response> {
  requestInit.headers && (requestInit.headers['Content-Type'] = 'application/json');
  body && (requestInit.body = JSON.stringify(body));

  return fetch(uri, requestInit);
}

function request<ResponseData = unknown>(
  method: RestMethod,
  url: string,
  options: RequestOptions<ResponseData> = { headers: settings.headers },
): ApiResult<ResponseData> {
  options.headers = options.headers || settings.headers;
  options.credentials = options.credentials ?? settings.credentials;

  const optionsPromiseThunk = () =>
    settings.requestInterceptor(options, {
      baseUrl: settings.baseUrl,
      url: url,
      method: method,
    });

  return optionsPromiseThunk().then(async (options) => {
    try {
      const {
        queryParams,
        body,
        files,
        headers,
        interceptor,
        mock,
        enableMock,
        meta: requestMeta,
        mockError,
        credentials,
      } = options;

      // Mocking for testing
      if (enableMock) {
        if (mockError) {
          throw {
            error: mockError,
            body,
            queryParams,
            url,
            statusCode: 400,
          };
        }

        return mock;
      }

      const baseUrl =
        typeof options.baseUrl === 'string'
          ? options.baseUrl
          : typeof settings.baseUrl === 'string'
          ? settings.baseUrl
          : undefined;
      const constructedUri = options.useRawUrl ? url : constructUriWithQueryParams(url, queryParams, baseUrl);

      const requestInitWithoutBody: RequestInit = {
        headers: headers,
        method: method,
        credentials,
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

      if (
        ((statusCode < min || statusCode >= max) && !whiteList.includes(statusCode)) ||
        blackList.includes(statusCode)
      ) {
        throw {
          error: new Error(`Network Code Denied`),
          body,
          queryParams,
          url,
          statusCode,
        };
      }

      let responseData: any;

      try {
        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('text') && (await response.text()).length) {
          throw new Error(`response content-type is not application/json, value: ${contentType}`);
        }

        if (contentType.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch (e) {
            responseData = undefined;
          }
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

      const mergedSerializedNames = settings.serializedNames;
      if (Object.keys(mergedSerializedNames).length) {
        responseData = convertJsonKeys(responseData, mergedSerializedNames);
      }

      try {
        responseData = await settings.responseInterceptor(responseData, statusCode, url, method, requestMeta);
      } catch (e) {
        throw {
          error: e,
          body,
          queryParams,
          url,
          statusCode,
        };
      }

      if (interceptor) {
        responseData = interceptor(responseData);
      }

      return responseData;
    } catch (e) {
      if (typeof e.url === 'string') {
        const { error, body, queryParams, url, statusCode } = e;
        throw settings.errorInterceptor({
          error,
          body,
          queryParams,
          url,
          statusCode,
        });
      } else {
        throw settings.errorInterceptor({ error: e, url, body: options.body, queryParams: options.queryParams });
      }
    }
  }) as any;
}

export default request;
