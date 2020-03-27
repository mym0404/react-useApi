import { ApiResult, Call, Unsubscribe } from './internal/ApiClient';
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
  unsubscribe: () => void;
  call: () => void;
} & {
  [P in keyof ResponseData]?: ResponseData[P];
};

type ActionTypes = 'SetUnsubscribe' | 'SetCall' | 'CallStart' | 'CallSuccess' | 'CallFail';
type Action<Payload = any> = { type: ActionTypes; payload?: Payload };
type ActionCreator<Payload = undefined> = (...args) => Action<Payload>;

const reducer = <ResponseData>(state: State<ResponseData>, { type, payload }: Action): State<ResponseData> => {
  switch (type) {
    case 'SetUnsubscribe':
      return { ...state, unsubscribe: payload };
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

const setUnsubscribe: ActionCreator<Unsubscribe> = (unsubscribe: Unsubscribe) => ({
  type: 'SetUnsubscribe',
  payload: unsubscribe,
});
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
  unsubscribe: (): void => {},
};

const useRest = <ResponseData>(
  api: ApiResult<ResponseData>,
  dependencies: any[] = [],
  cold = false,
  onSuccess: (data: ResponseData) => void = (): void => {},
  onFail: (e: Error) => void = (): void => {},
): State<ResponseData> => {
  const [state, dispatch] = useReducer<(prevState: State<ResponseData>, action: Action) => State<ResponseData>>(
    reducer,
  initialState,
  );

  const previousDependencies = useRef<any[]>();

  useEffect(() => {
    if (isDirtyDependencies(dependencies, previousDependencies.current)) {
      previousDependencies.current = dependencies;

      const callApi = async (): Promise<void> => {
        const [call, cancel] = api;

        dispatch(
          setUnsubscribe(() => {
            console.log('unsubscribe');
            cancel();
          }),
        );

        if (cold) {
          dispatch(
            setCall(
              async (): Promise<void> => {
                try {
                  state.unsubscribe();
                  dispatch(callStart());
                  const data = await call();
                  dispatch(callSuccess(data));
                  onSuccess(data);
                } catch (e) {
                  dispatch(callFail(e));
                  onFail(e);
                }
              },
            ),
          );
        } else {
          try {
            state.unsubscribe();
            dispatch(callStart());
            const data = await call();
            dispatch(callSuccess(data));
            onSuccess(data);
          } catch (e) {
            dispatch(callFail(e));
            onFail(e);
          }
        }
      };

      callApi().then();
    }
    return (): void => {
      state.unsubscribe && state.unsubscribe();
    };
  }, [api, cold, dependencies, state, onFail, onSuccess]);

  return { ...state };
};

export default useRest;
