import convertObjectKeysCamelCaseFromSnakeCase from './convertObjectKeysCamelCaseFromSnakeCase';

type RestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Header = { [P in string]: string } & { 'Content-Type'?: ContentType; Accept: ContentType; Authorization?: string };

type ReactNativeFile = {
  key: string;
  file: {
    name: string;
    uri: string;
    type: string;
  };
};

type ContentType = 'application/json' | 'application/x-www-form-urlencoded;charset=UTF-8' | 'multipart/form-data';

/**
 * The method for uploading files to api server.
 * This method won't be used from external modules
 *
 * Note: **the properties in body object will be casted to string** because of Content-Type is fixed with multipart/form-data
 */
async function upload(
  uri: string,
  requestInit: RequestInit,
  files: ReactNativeFile[],
  body?: object,
): Promise<Response> {
  const formData = new FormData();

  body &&
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, JSON.stringify(value));
    });

  Object.entries(files).forEach(([key, file]) => {
    formData.append(key, file);
  });

  requestInit.headers && (requestInit.headers['Content-Type'] = 'multipart/form-data');
  requestInit.body = formData;

  return await fetch(uri, requestInit);
}

async function requestFormUrlEncoded(uri: string, requestInit: RequestInit, body?: object): Promise<Response> {
  let encodedBody = new URLSearchParams();

  if (body instanceof URLSearchParams) {
    encodedBody = body;
  } else {
    body &&
      Object.entries(([key, value]) => {
        encodedBody.append(encodeURIComponent(key), encodeURIComponent(value));
      });
  }

  requestInit.headers && (requestInit.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8');
  requestInit.body = encodedBody;

  return await fetch(uri, requestInit);
}

async function requestJson(uri: string, requestInit: RequestInit, body?: object): Promise<Response> {
  requestInit.headers && (requestInit.headers['Content-Type'] = 'application/json');
  body && (requestInit.body = JSON.stringify(body));

  return await fetch(uri, requestInit);
}

function constructUriWithQueryParams(uri: string, queryParams?: object) {
  const paramsFromUri = new URLSearchParams(uri);
  const params = new URLSearchParams();

  queryParams &&
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, value + '');
    });

  paramsFromUri.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return encodeURI(uri + params.toString());
}

async function request<ResponseData = undefined>(
  method: RestMethod,
  uri: string,
  contentType?: ContentType,
  queryParams?: object,
  body?: object,
  files?: ReactNativeFile[],
  headers?: Header,
): Promise<ResponseData & { cancel: () => void }> {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;

  const constructedUri = constructUriWithQueryParams(uri, queryParams);

  const requestInitWithoutBody: RequestInit = {
    headers: headers,
    method: method,
    signal: abortSignal,
  };

  let res: Response;

  if (contentType === 'multipart/form-data' || (method === 'POST' && files)) {
    res = await upload(constructedUri, requestInitWithoutBody, files, body);
  } else if (contentType === 'application/x-www-form-urlencoded;charset=UTF-8' || body instanceof URLSearchParams) {
    res = await requestFormUrlEncoded(constructedUri, requestInitWithoutBody, body);
  } else {
    res = await requestJson(uri, requestInitWithoutBody, body);
  }

  const responseData = await res.json();
  // @ts-ignore
  return { ...convertObjectKeysCamelCaseFromSnakeCase(responseData), cancel: abortController.abort };
}

export default request;
