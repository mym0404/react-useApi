import { ApiResult, useRest } from '..';
import { act, renderHook } from '@testing-library/react-hooks';

import { useCall } from '../useRest';

type ResponseType = {
  name: string;
  age: number;
};
const responseData: ResponseType = { name: 'mj', age: 24 };
let unsubscribeMock = jest.fn();
let dataPromiseMock = jest.fn();
let apiResultMock: ApiResult<ResponseType>;

let dependencies: any[] = [1, 2, 3];

describe('useRest', () => {
  beforeEach(() => {
    apiResultMock = [dataPromiseMock, unsubscribeMock];
    unsubscribeMock.mockReset();
    dataPromiseMock.mockReset();
    dataPromiseMock.mockResolvedValueOnce(responseData);
  });

  it('hot api call should change states corretly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useRest(apiResultMock, []));

    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(true);
    expect(result.current.name).toBe(undefined);

    await waitForNextUpdate();
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.name).toBe('mj');

    expect(dataPromiseMock).toBeCalledTimes(1);
  });

  it('cold api call should change states corretly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useCall(apiResultMock, []));

    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.name).toBe(undefined);

    act(() => {
      result.current.call();
    });
    expect(result.current.loading).toBe(true);

    await waitForNextUpdate();
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.name).toBe('mj');

    expect(dataPromiseMock).toBeCalledTimes(1);
  });

  it('Api call failed', async () => {
    const failedApi = jest.fn().mockRejectedValue(new Error('api is failed'));
    const apiResultMock: ApiResult = [failedApi, unsubscribeMock];

    const { result, waitForNextUpdate } = renderHook(() => useRest(apiResultMock));

    await waitForNextUpdate();

    expect(failedApi).toBeCalledTimes(1);
  });

  it('dependencies will be dirty', async () => {
    const { rerender, waitForNextUpdate } = renderHook(() => useRest(apiResultMock, dependencies));

    await waitForNextUpdate();
    expect(dataPromiseMock).toBeCalledTimes(1);

    dependencies = [4, 5, 6];
    rerender();

    await waitForNextUpdate();
    expect(dataPromiseMock).toBeCalledTimes(2);

    dependencies = [1];
    rerender();

    await waitForNextUpdate();
    expect(dataPromiseMock).toBeCalledTimes(3);

    dependencies = ['string'];
    rerender();

    await waitForNextUpdate();
    expect(dataPromiseMock).toBeCalledTimes(4);

    // If dependencies is same, then call will be not invoked/

    dependencies = ['string'];
    rerender();

    expect(dataPromiseMock).toBeCalledTimes(4);
  });

  it('unmount will unsubscribe', async () => {
    const { rerender, waitForNextUpdate, unmount } = renderHook(() => useRest(apiResultMock));
    unmount();
  });

  it('when api throw,  unmount will unsubscribe', async () => {
    const failedApi = jest.fn().mockRejectedValue(new Error('api is failed'));
    const apiResultMock: ApiResult = [failedApi, unsubscribeMock];

    const { rerender, waitForNextUpdate, unmount } = renderHook(() => useRest(apiResultMock));
    unmount();
  });
});
