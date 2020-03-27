# useApi

## Usage

### 1. Set default settings for network call process.(Optional)

Put following code in the application entry like `index.js`.
All fields are optional.
The default values are following.

```ts
setApiDefaultSettings({
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  baseUrl: '',
  timeout: 5000,
  requestInterceptor: (request) => request,
  responseInterceptor: (response) => response,
  responseInterceptorAddons: [],
  responseCodeWhiteListRange: { minInclude: 200, maxExclude: 300 },
  responseCodeWhiteList: [], // number[]
  responseCodeBlackList: [], // number[]
  logging: false,
});
```

You can reset to default values.

```ts
clearApiDefaultSettings();
```

In `responseInterceptor`, the parameter is body(data) object(or array)in response.

`requestInterceptor` and `responseInterceptor` also receive `Promise` for async tasks.
**You must return processed `request` and `response` in the interceptors!**

```ts
setApiDefaultSettings({
  requestInterceptor: async (request) => {
    request.headers.Authorization = AsyncStorage.getItem('accessToken') || '';
    return request;
  },
  responseInterceptor: async (response) => {
    await logToServer(response)
    return response;
  },
});
```

There are response interceptor addons(currently, only `CAMELCASE`).
You can set this addons to `setApiDefaultSettings`

```ts
setApiDefaultSettings({
  // response data from server like { my_name: 'mj' } is converted with { myName: 'mj' }
  responseInterceptorAddons: [ResponseInterceptorAddOn.CAMELCASE], 
});
```

### 2. Declare your REST api routers

- Use `GET`, `POST`, `PUT`, `PATCH`, `DELETE` in the library.
**this is even not async function or return promise!** 😀

- Return with `ApiResult<your data type>`

```ts
type FetchVersion = {
  androidMinimumVersion: number;
  iosMinimumVersion: number;
};
export const fetchVersion = (): ApiResult<FetchVersion> => {
  return GET('version/', {
    headers: { token: myToken },
    body: { bodyData: 1 },
    files: [{ key: 'movie', file: { name: 'movie', type: 'video/*', uri: 'video/path' } }],
    queryParams: { name: 'queryParamsName' },
  });
};
```
