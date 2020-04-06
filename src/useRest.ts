import { ApiResult, Call } from './internal/ApiClient';
import { useEffect, useReducer, useRef } from 'react';

import { JSONCandidate } from './internal/convertObjectKeysCamelCaseFromSnakeCase';

function isDirtyDependencies(dep1: any[] | undefined, dep2: any[] | undefined): boolean {
  if (!dep1 || !dep2) return true;
  if (dep1.length !== dep2.length) return true;

  for (let i = 0; i < dep1.length; i++) {
    if (typeof dep1[i] !== typeof dep2[i]) {
      return true;
    }
    if (!Object.is(dep1[i], dep2[i])) {
      return true;
    }
  }

  return false;
}

type State<ResponseData = JSONCandidate> = {
  success: boolean;
  loading: boolean;
  error: Error | null;
  call: () => void;
} & {
  [P in keyof ResponseData]?: ResponseData[P];
};

type ActionTypes = 'SetCall' | 'CallStart' | 'CallSuccess' | 'CallFail';
type Action<Payload = any> = { type: ActionTypes; payload?: Payload };
type ActionCreator<Payload = undefined> = (...args) => Action<Payload>;

const reducer = <ResponseData>(state: State<ResponseData>, { type, payload }: Action): State<ResponseData> => {
  switch (type) {
    case 'SetCall':
      return { ...state, call: payload };
    case 'CallStart':
      return {
        ...state,
        error: null,
        loading: true,
        success: false,
      };
    case 'CallSuccess':
      return {
        ...state,
        error: null,
        loading: false,
        success: true,
        ...(payload as object),
      };
    case 'CallFail':
      return {
        ...state,
        error: payload,
        loading: false,
        success: false,
      };
  }
  return state;
};

const setCall: ActionCreator<Call> = (call: Call) => ({
  type: 'SetCall',
  payload: call,
});
const callStart: ActionCreator = () => ({
  type: 'CallStart',
});
const callSuccess: ActionCreator<JSONCandidate> = (data: JSONCandidate) => ({
  type: 'CallSuccess',
  payload: data,
});
const callFail: ActionCreator<Error> = (error: Error) => ({
  type: 'CallFail',
  payload: error,
});

const initialState: State = {
  call: (): void => {},
  error: null,
  loading: false,
  success: false,
};

const useRest = <ResponseData>(
  api: ApiResult<ResponseData>,
  dependencies: any[] = [],
  cold = false,
  onSuccess: (data: ResponseData) => void = (): void => {},
  onFail: (e: any) => void = (): void => {},
): State<ResponseData> => {
  const unmounted = useRef(false);
  const fetching = useRef(false);

  const [state, dispatch] = useReducer<(prevState: State<ResponseData>, action: Action) => State<ResponseData>>(
    reducer,
  initialState,
  );

  const previousDependencies = useRef<any[]>();

  const onSuccessRef = useRef<any>();
  const onFailRef = useRef<any>();
  onSuccessRef.current = onSuccess;
  onFailRef.current = onFail;

  useEffect(() => {
    if (isDirtyDependencies(dependencies, previousDependencies.current)) {
      previousDependencies.current = dependencies;

      const callApi = async (): Promise<void> => {
        const [call] = api;

        if (cold) {
          dispatch(
            setCall(
              async (): Promise<void> => {
                try {
                  if (fetching.current) {
                    return;
                  }
                  fetching.current = true;
                  dispatch(callStart());
                  const data = await call();
                  if (!unmounted.current) {
                    dispatch(callSuccess(data));
                    onSuccessRef.current(data);
                  }
                  fetching.current = false;
                } catch (e) {
                  if (!unmounted.current) {
                    dispatch(callFail(e));
                    onFailRef.current(e);
                  }
                  fetching.current = false;
                }
              },
            ),
          );
        } else {
          try {
            dispatch(callStart());
            const data = await call();
            if (!unmounted.current) {
              dispatch(callSuccess(data));
              onSuccessRef.current(data);
            }
          } catch (e) {
            if (!unmounted.current) {
              dispatch(callFail(e));
              onFailRef.current(e);
            }
          }
        }
      };
      callApi().then();
    }
  }, [api, cold, dependencies, state, onFail, onSuccess, unmounted]);

  useEffect(() => {
    return (): void => {
      unmounted.current = true;
    };
  }, []);

  return { ...state };
};

const useCall = <ResponseData>(
  api: ApiResult<ResponseData>,
  dependencies: any[] = [],
  onSuccess: (data: ResponseData) => void = (): void => {},
  onFail: (e: any) => void = (): void => {},
): State<ResponseData> => {
  return useRest(api, dependencies, true, onSuccess, onFail);
};
export { useRest, useCall };
export default useRest;
