import { clearApiDefaultSettings, setApiDefaultSettings } from './index';

import { FetchMock } from 'jest-fetch-mock';
import { JSONCandidate } from '@mj-studio/js-util';
import RestClient from './RestAdapter';

jest.useRealTimers();

declare const fetchMock: FetchMock;
function mockSimpleResponseOnce(uri?: string | RegExp, body?: JSONCandidate): void {
  fetchMock.resetMocks();
  const simpleBody = body ? JSON.stringify(body) : JSON.stringify({ success: true });

  if (uri) {
    fetchMock.mockIf(uri, async () => {
      return { status: 200, body: simpleBody, headers: { 'Content-Type': 'application/json', 'Content-Length': '3' } };
    });
  } else {
    fetchMock.once(async () => {
      return { status: 200, body: simpleBody, headers: { 'Content-Type': 'application/json', 'Content-Length': '3' } };
    });
  }
}

describe('Call - ', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockSimpleResponseOnce();
  });

  it("Network error doesn't affect interceptor process", async () => {
    fetchMock.mockReset();
    fetchMock.mockReject(new Error('my error'));

    const dataPromise = RestClient.GET('', {
      interceptor: (data: any) => {
        return {
          user_name: data.first_name + data.last_name,
        };
      },
    });

    try {
      await dataPromise;
    } catch (e) {
      expect(e.message).toBe('my error');
    }
  });

  it("JSON parsing error doesn't affect interceptor process", async () => {
    expect.assertions(1); // ensure that interceptor won't run

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: 'not json!',
      headers: { 'Content-Type': 'text/plain', 'Content-Length': '3' },
    }));

    const dataPromise = RestClient.GET('', {
      interceptor: (data: any) => {
        expect(data).toBeTruthy();
        expect(data).toBeTruthy();
        return {
          user_name: data.first_name + data.last_name,
        };
      },
    });

    try {
      await dataPromise;
    } catch (e) {
      expect(e.message).toBe('response content-type is not application/json, value: text/plain');
    }
  });

  it('not application/json content type and content-length > 0 response is rejected', async () => {
    expect.assertions(1); // ensure that interceptor won't run

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: 'not json!',
      headers: { 'Content-Type': 'text/plain', 'Content-Length': '3' },
    }));

    const dataPromise = RestClient.GET('');

    try {
      await dataPromise;
    } catch (e) {
      expect(e.message).toBe('response content-type is not application/json, value: text/plain');
    }
  });

  it('not application/json content type and text is not empty will be rejected', async () => {
    expect.assertions(1);

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: 'Server Error',
      headers: { 'Content-Type': 'text/plain' },
    }));

    const dataPromise = RestClient.GET('');

    try {
      expect(await dataPromise).toEqual({});
    } catch (e) {
      expect(e.message).toBe('response content-type is not application/json, value: text/plain');
    }
  });

  it('JSON parsing error will be rejected', async () => {
    expect.assertions(1);

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: 'not json!',
      headers: { 'Content-Type': 'text/plain', 'Content-Length': '3' },
    }));

    const dataPromise = RestClient.GET('');

    try {
      await dataPromise;
    } catch (e) {
      expect(1).toBe(1);
    }
  });

  it('content-type of response header is application/json => result will be parsed', async () => {
    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'mj' }) };
    });

    const dataPromise = RestClient.GET('');

    const result = await dataPromise;
    expect(result).toEqual({ name: 'mj' });
  });

  it('content-type of response header is application/json; charset=utf8; => result will be parsed', async () => {
    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf8' },
        body: JSON.stringify({ name: 'mj' }),
      };
    });

    const dataPromise = RestClient.GET('');

    const result = await dataPromise;
    expect(result).toEqual({ name: 'mj' });
  });

  it('Empty response => not fail', async () => {
    expect.assertions(0);

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: undefined,
    }));

    const dataPromise = RestClient.GET('');

    try {
      await dataPromise;
    } catch (e) {
      expect(1).toBe(1);
    }
  });

  it('Not empty response => fail', async () => {
    expect.assertions(1);

    fetchMock.mockReset();
    fetchMock.mockOnce(async () => ({
      status: 200,
      body: JSON.stringify({ name: '<html><body>NotFound 404</body></html>' }),
      headers: { 'Content-Type': 'text/html', 'Content-Length': '3' },
    }));

    const dataPromise = RestClient.GET('');

    try {
      await dataPromise;
    } catch (e) {
      expect(1).toBe(1);
    }
  });

  it('mock data is returnned if enabledMock = true', async () => {
    const dataPromise = RestClient.GET('', {
      enableMock: true,
      mock: {
        name: 'hello world!',
      }
    })
    const data = await dataPromise;
    expect(data).toEqual({name: 'hello world!'});
  })

  it('REST adapter response interceptor working well', async () => {
    mockSimpleResponseOnce(null, {
      user_first_name: 'm',
      user_last_name: 'j',
    });

    const dataPromise = RestClient.GET('', {
      interceptor: ({ user_first_name, user_last_name }: any) => ({ userName: user_first_name + user_last_name }),
    });

    const data = await dataPromise;

    expect(data).toEqual({ userName: 'mj' });
  });

  it('serializedNames in settings converts json keys', async () => {
    setApiDefaultSettings({ serializedNames: { before: 'after' } });

    mockSimpleResponseOnce(null, {
      before: 1,
    });

    const dataPromise = RestClient.GET('');

    const data = await dataPromise;

    expect(data).toEqual({
      after: 1,
    });

    clearApiDefaultSettings();
  });

  it('throw in async responseInterceptor should invoke errorInterceptor and caught in catch block', async () => {
    expect.assertions(6);

    mockSimpleResponseOnce(null, { code: 42, message: 'hi' });

    setApiDefaultSettings({
      responseInterceptor: async (response: any) => {
        expect(response.code).toBe(42);
        expect(response.message).toBe('hi');
        throw response;
      },
      errorInterceptor: ({ error: { code, message } }) => {
        expect(code).toBe(42);
        expect(message).toBe('hi');

        return { code, message };
      },
    });

    const dataPromise = RestClient.GET('');
    try {
      await dataPromise;
    } catch ({ code, message }) {
      expect(code).toBe(42);
      expect(message).toBe('hi');
    }

    clearApiDefaultSettings();
  });

  it('[GIVEN] errorInterceptor is set [WHEN] call ftp protocol [THEN] fail with unknown status code', async () => {
    setApiDefaultSettings({
      errorInterceptor: ({ error: e, statusCode }) => ({ error: e, statusCode: statusCode }),
    });
    fetchMock.resetMocks();
    fetchMock.disableMocks();

    const dataPromise = RestClient.GET('ftp://network/error/');

    try {
      await dataPromise;
    } catch ({ error, statusCode }) {
      expect(error.name).toBe('TypeError');
      expect(error.message).toBe('Only HTTP(S) protocols are supported');
      expect(statusCode).toBe(undefined);
    }

    fetchMock.enableMocks();
    clearApiDefaultSettings();
  });

  it('[GIVEN] custom errorInterceptor is set [WHEN] call [THEN] custom exception data is caught', async () => {
    setApiDefaultSettings({
      errorInterceptor: function () {
        return { code: 444, message: 'satan' };
      },
    });
    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return {
        status: 405,
        body: JSON.stringify({
          code: 444,
          message: 'satan',
        }),
      };
    });
    const dataPromise = RestClient.GET('');

    expect.assertions(2);

    try {
      await dataPromise;
    } catch (e) {
      expect(e.code).toBe(444);
      expect(e.message).toBe('satan');
    }

    clearApiDefaultSettings();
  });

  it('[GIVEN] network response status code = 400 & defaultSettings [THEN] call fail', () => {
    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return { status: 400, body: JSON.stringify({}) };
    });
    const dataPromise = RestClient.GET('');

    expect.assertions(2);

    return dataPromise
      .then()
      .catch((e) => {
        expect(e.name).toBe('Error');
        expect(e.message).toBe(
          "Status Code [400] doesn't exist in responseCodeWhiteListRange [200, 300). If you want to include 400 to white list, use responseCodeWhiteList settings in setApiDefaultSettings()",
        );
      });
  });

  it('[GIVEN] network response status code = 400 & responseCodeWhiteListRange [200, 500) [THEN] call success', async () => {
    setApiDefaultSettings({ responseCodeWhiteListRange: { minInclude: 200, maxExclude: 500 } });

    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return {
        status: 400,
        body: JSON.stringify({ name: 'mj' }),
        headers: { 'Content-Type': 'application/json', 'Content-Length': '3' },
      };
    });
    const dataPromise = RestClient.GET<{ name: string }>('');

    const data = await dataPromise;
    expect(data.name).toBe('mj');

    clearApiDefaultSettings();
  });

  it('[GIVEN] network response status code = 400 & 400 in white list [THEN] call success', async () => {
    setApiDefaultSettings({ responseCodeWhiteList: [400] });

    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return {
        status: 400,
        body: JSON.stringify({ name: 'mj' }),
        headers: { 'Content-Type': 'application/json', 'Content-Length': '3' },
      };
    });
    const dataPromise = RestClient.GET<{ name: string }>('');

    const data = await dataPromise;
    expect(data.name).toBe('mj');

    clearApiDefaultSettings();
  });

  it('[GIVEN] network response status code = 200 & 200 in black list [THEN] call success', async () => {
    setApiDefaultSettings({ responseCodeBlackList: [200, 100] });

    fetchMock.resetMocks();
    fetchMock.once(async () => {
      return { status: 200, body: JSON.stringify({ name: 'mj' }) };
    });
    const dataPromise = RestClient.GET<{ name: string }>('');

    expect.assertions(2);
    try {
      await dataPromise;
    } catch ({ name, message }) {
      expect(name).toBe('Error');
      expect(message).toBe('Status Code [200] exists in responseCodeBlackList [200,100]');
    }

    clearApiDefaultSettings();
  });

  it('[GIVEN] Network Error [WHEN] request api [THEN] promise will be rejected', () => {
    fetchMock.resetMocks();
    fetchMock.mockRejectOnce(new Error('Network Fail!'));

    const dataPromise = RestClient.GET('');

    expect.assertions(2);

    return dataPromise
      .then(() => {
        clearApiDefaultSettings();
      })
      .catch((e) => {
        expect(e.name).toBe('Error');
        expect(e.message).toBe('Network Fail!');
      });
  });

  it('[GIVEN] requestInterceptor is a Promise [THEN] call success', async () => {
    setApiDefaultSettings({ requestInterceptor: (request) => Promise.resolve(request) });
    const dataPromise = RestClient.GET('');
    await dataPromise;
    clearApiDefaultSettings();
  });

  it('[GIVEN] responseInterceptor is a Promise [THEN] call success', async () => {
    setApiDefaultSettings({ responseInterceptor: (response) => Promise.resolve(response) });
    const dataPromise = RestClient.GET('');
    await dataPromise;
    clearApiDefaultSettings();
  });

  it('[GIVEN] response with array [THEN] call success', async () => {
    mockSimpleResponseOnce(null, [1, 2, { name: 'mj' }, 4, [1, 2, 3, 4, 5]]);
    const dataPromise = RestClient.GET<number[]>('');
    const data = await dataPromise;
    expect(data).toEqual([1, 2, { name: 'mj' }, 4, [1, 2, 3, 4, 5]]);
  });

  it('[GIVEN] baseUrl set [THEN] call success', async () => {
    setApiDefaultSettings({ baseUrl: 'https://virtserver.swaggerhub.com/freedom07/Mathking/1.1/' });
    mockSimpleResponseOnce('https://virtserver.swaggerhub.com/freedom07/Mathking/1.1/getMyName', { my_name: 'mj' });
    const dataPromise = RestClient.GET<{ my_name: string }>('getMyName');
    const data = await dataPromise;
    expect(data.my_name).toBe('mj');
    clearApiDefaultSettings();
  });

  describe.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])('RestAdapter[%p] - ', (restMethod): void => {
    it('[GIVEN] application/json [THEN] should be success', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('');
      const { success } = await dataPromise;
      expect(success).toBe(true);
    });

    it('[GIVEN] application/json [WHEN] with object body [THEN] should be success without GET', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        body: { name: 'dooboo' },
      });

      if (restMethod !== 'GET') {
        const { success } = await dataPromise;
        expect(success).toBe(true);
      } else {
        try {
          await dataPromise;
        } catch (e) {
          expect(e.name).toBe('TypeError');
          expect(e.message).toBe('Request with GET/HEAD method cannot have body');
        }
      }
    });

    it('[GIVEN] application/x-www-form-urlencoded;charset=UTF-8 [WHEN] by specify header [THEN] should be success', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      });
      const { success } = await dataPromise;
      expect(success).toBe(true);
    });

    it('[GIVEN] application/x-www-form-urlencoded;charset=UTF-8 [WHEN] by URLSearchParams body [THEN] should be success', async () => {
      const body = new URLSearchParams();
      body.set('name', 'dooboo');
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        body,
      });
      const { success } = await dataPromise;
      expect(success).toBe(true);
    });

    it('[GIVEN] application/x-www-form-urlencoded;charset=UTF-8 [WHEN] by specify header with object body [THEN] should be success without GET', async () => {
      const body = { name: 'dooboo' };
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });

      if (restMethod !== 'GET') {
        const { success } = await dataPromise;
        expect(success).toBe(true);
      } else {
        try {
          await dataPromise;
        } catch (e) {
          expect(e.name).toBe('TypeError');
          expect(e.message).toBe('Request with GET/HEAD method cannot have body');
        }
      }
    });

    it('[GIVEN] multipart/form-data [WHEN] by header [THEN] should be success without GET', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (restMethod !== 'GET') {
        const { success } = await dataPromise;
        expect(success).toBe(true);
      } else {
        try {
          await dataPromise;
        } catch (e) {
          expect(e.name).toBe('TypeError');
          expect(e.message).toBe('Request with GET/HEAD method cannot have body');
        }
      }
    });

    it('[GIVEN] multipart/form-data [WHEN] by file [THEN] should be success without GET', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        files: [{ key: 'thumbnail', file: { uri: 'file://my/video/file/path.mp4', name: 'video', type: 'video/*' } }],
      });

      if (restMethod !== 'GET') {
        const { success } = await dataPromise;
        expect(success).toBe(true);
      } else {
        try {
          await dataPromise;
        } catch (e) {
          expect(e.name).toBe('TypeError');
          expect(e.message).toBe('Request with GET/HEAD method cannot have body');
        }
      }
    });

    it('[GIVEN] multipart/form-data [WHEN] by header with object body [THEN] should be success without GET', async () => {
      const dataPromise = RestClient[restMethod]<{ success: boolean }>('', {
        headers: { 'Content-Type': 'multipart/form-data' },
        body: { name: 'dooboo' },
      });

      if (restMethod !== 'GET') {
        const { success } = await dataPromise;
        expect(success).toBe(true);
      } else {
        try {
          await dataPromise;
        } catch (e) {
          expect(e.name).toBe('TypeError');
          expect(e.message).toBe('Request with GET/HEAD method cannot have body');
        }
      }
    });
  });


});
