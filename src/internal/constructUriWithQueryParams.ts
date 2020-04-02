export function constructUriWithQueryParams(
  uri: string,
  queryParams?: object,
  baseUrl = '',
  loggingError = false,
): string {
  const parameters = new Map<string, string>();

  try {
    const url = encodeURI(baseUrl + uri);

    const questionMarkIndex = url.indexOf('?');
    if (questionMarkIndex !== -1) {
      url
        .slice(questionMarkIndex + 1)
        .split('&')
        .forEach((raw) => {
          const [key, value] = raw.split('=');
          parameters.set(key, value);
        });
    }
    queryParams &&
      Object.entries(queryParams).forEach(([key, value]) => {
        parameters.set(key, value);
      });

    let urlWithoutQueryParams: string;
    if (questionMarkIndex !== -1) {
      urlWithoutQueryParams = url.slice(0, questionMarkIndex);
    } else {
      urlWithoutQueryParams = url;
    }

    if (parameters.size === 0) {
      return urlWithoutQueryParams;
    } else {
      let queryParamsString = '';
      parameters.forEach((value, key) => {
        queryParamsString += `${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
      });
      return urlWithoutQueryParams + '?' + queryParamsString.slice(0, -1);
    }
  } catch (e) {
    if (loggingError) {
      // eslint-disable-next-line no-console
      console.warn(e);
    }
    return uri;
  }
}
