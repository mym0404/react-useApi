import 'abortcontroller-polyfill';

import convertObjectKeysCamelCaseFromSnakeCase, { JSONCandidate } from './convertObjectKeysCamelCaseFromSnakeCase';

import { constructUriWithQueryParams } from './constructUriWithQueryParams';
import convertJsonKeys from './convertJsonKeys';
import isPlainObject from './isPlainObject';
import isPromise from './isPromise';

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
  interceptor?: (json: JSONCandidate) => ResponseData;
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
) => RequestOptions<ResponseData> | Promise<RequestOptions<ResponseData>>;

type ResponseDataInterceptorAddOnNames = 'CAMELCASE';

export const ResponseInterceptorAddOn: { [P in ResponseDataInterceptorAddOnNames]: ResponseDataInterceptor<{}> } = {
  CAMELCASE: (response) => {
    return convertObjectKeysCamelCaseFromSnakeCase(response);
  },
};

export type ResponseDataInterceptor<ResponseData extends JSONCandidate> = (
  responseData: ResponseData,
  statusCode: number,
) => ResponseData | Promise<ResponseData>;

export type Settings<ResponseData extends JSONCandidate> = {
  headers: Header;
  baseUrl: string;
  timeout: number;
  errorInterceptor: (error: any, statusCode?: number) => any;
  requestInterceptor: RequestOptionsInterceptor<ResponseData>;
  responseInterceptor: ResponseDataInterceptor<ResponseData>;
  responseInterceptorAddons: ResponseDataInterceptor<ResponseData>[];
  responseCodeWhiteListRange: { minInclude: number; maxExclude: number };
  responseCodeWhiteList: number[];
  responseCodeBlackList: number[];
  logging: boolean;
};

const initialSettings: Settings<{}> = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  baseUrl: '',
  timeout: 5000,
  errorInterceptor: (error) => error,
  requestInterceptor: (request) => request,
  responseInterceptor: (response) => response,
  responseInterceptorAddons: [],
  responseCodeWhiteListRange: { minInclude: 200, maxExclude: 300 },
  responseCodeWhiteList: [],
  responseCodeBlackList: [],

  logging: false,
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

  const callPromise: CallPromise<ResponseData> = () =>
    withTimeout(
      settings.timeout,
      new Promise<ResponseData>((resolve, reject): void => {
        // Intercept Request Options

        options.headers = options.headers || settings.headers;

        let optionsPromise = settings.requestInterceptor(options, {
          baseUrl: settings.baseUrl,
          url: url,
          timout: settings.timeout,
          method: method,
        });
        if (!isPromise(optionsPromise)) {
          optionsPromise = Promise.resolve(optionsPromise);
        }

        optionsPromise.then(
          async (options): Promise<void> => {
            try {
              const { queryParams, body: _body, files, headers, serializedNames, interceptor } = options;

              const constructedUri = constructUriWithQueryParams(url, queryParams, settings.baseUrl, settings.logging);

              const requestInitWithoutBody: RequestInit = {
                headers: headers,
                method: method,
                signal: abortSignal,
              };

              let responsePromise: Promise<Response>;

              let body = _body;

              if ((isPlainObject(body) || Array.isArray(body)) && serializedNames) {
                body = convertJsonKeys(body, serializedNames);
              }

              if (settings.logging) {
                // eslint-disable-next-line no-console
                console.log(`🌈[${method}] - [${constructedUri}] - ${JSON.stringify(body, null, 2)}`);
              }

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
                reject(
                  settings.errorInterceptor(
                    new Error(
                      // eslint-disable-next-line max-len
                      `Status Code [${statusCode}] doesn't exist in responseCodeWhiteListRange [${min}, ${max}). If you want to include ${statusCode} to white list, use responseCodeWhiteList settings in setApiDefaultSettings()`,
                    ),
                    statusCode,
                  ),
                );
                return;
              } else if (blackList.includes(statusCode)) {
                reject(
                  settings.errorInterceptor(
                    new Error(`Status Code [${statusCode}] exists in responseCodeBlackList [${blackList}]`),
                    statusCode,
                  ),
                );
                return;
              }

              let responseData: ResponseData = {} as ResponseData;
              try {
                // TODO currently, only return response as json
                let json = await response.json();
                if (settings.logging) {
                  // eslint-disable-next-line no-console
                  console.log(`🌈Api Response Body - ${JSON.stringify(json, null, 2)}`);
                }

                if (serializedNames) {
                  json = convertJsonKeys(json, serializedNames);
                }

                if (interceptor) {
                  json = interceptor(json);
                }

                let responseDataOrPromise: Promise<{}> | {};

                try {
                  responseDataOrPromise = settings.responseInterceptor(json, statusCode);

                  if (isPromise(responseDataOrPromise)) {
                    json = await responseDataOrPromise;
                  } else {
                    json = responseDataOrPromise;
                  }
                } catch (e) {
                  const interceptedError = settings.errorInterceptor(e, statusCode);
                  reject(interceptedError);
                  throw interceptedError;
                }

                responseData = json as ResponseData;

                // AddOns
                settings.responseInterceptorAddons.forEach((addOn) => {
                  responseData = addOn(responseData, statusCode) as ResponseData;
                });
              } catch (e) {
                // Ignore empty body parsing or not json body

                if (settings.logging) {
                  // eslint-disable-next-line no-console
                  console.warn(e);
                }
              } finally {
                resolve(responseData);
              }
            } catch (e) {
              if (settings.logging) {
                // eslint-disable-next-line no-console
                console.warn(e);
              }
              reject(settings.errorInterceptor(e));
            }
          },
        );
      }),
    );

  return [
    callPromise,
    (): void => {
      abortController.abort();
    },
  ];
}

export default request;
