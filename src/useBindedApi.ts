import { useCallback, useEffect, useRef } from 'react';
import { ApiResult } from './internal/ApiClient';

type Abort = () => void;
type UseBindThunk = {
  callApiWithBind: <T>(apiResult: ApiResult<T>) => Promise<T>;
  abortAll: () => void;
};
const useBindedApi = (): UseBindThunk => {
  const unmounted = useRef(false);
  useEffect(() => {
    return () => {
      unmounted.current = true;
    };
  }, []);

  const abortsRef = useRef<Abort[]>([]);

  const bindPromiseToLifecycle = useCallback(
    async <T>({ thunk, abort }: { thunk: () => Promise<T>; abort: () => void }): Promise<T> => {
      abortsRef.current.push(abort);

      let result: T;
      let error: any;

      try {
        result = await thunk();
      } catch (e) {
        error = e;
      } finally {
        const idx = abortsRef.current.findIndex(abort);
        if (idx !== -1) {
          abortsRef.current.splice(idx, 1);
        }
      }

      /* Do not invoke handlers after component is unmounted */
      if (unmounted.current) {
        return {
          then: () => {
          },
          catch: () => {
          },
          finally: () => {
          },
        } as Promise<T>;
      }

      if (error) {
        throw error;
      }

      return result!;
    },
    [],
  );

  const callApiWithBind = useCallback(
    async <T>([call, unsubscribe]: ApiResult<T>) => {
      return bindPromiseToLifecycle<T>({
        thunk: call,
        abort: unsubscribe,
      });
    },
    [bindPromiseToLifecycle],
  );

  const abortAll = useCallback(() => {
    abortsRef.current.forEach((abort) => {
      abort();
    });
    abortsRef.current = [];
  }, []);
  useEffect(() => {
    return () => {
      abortAll();
    };
  }, [abortAll]);

  return { abortAll, callApiWithBind };
};
export default useBindedApi;
