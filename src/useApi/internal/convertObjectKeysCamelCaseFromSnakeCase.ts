import convertCamelCaseFromSnakeCase from './convertCamelCaseFromSnakeCase';
import isPlainObject from './isPlainObject';

export type Candidate = any[] | object;

function isArray<T>(objOrArray: Candidate): objOrArray is any[] {
  return Array.isArray(objOrArray);
}

function convertObjectKeysCamelCaseFromSnakeCase(objOrArr: Candidate): Candidate {
  if (isArray(objOrArr)) {
    return (objOrArr).map(convertObjectKeysCamelCaseFromSnakeCase);
  } else {
    const camelCaseObject: object = {};

    Object.entries(objOrArr).forEach(([key, value]) => {
      if (isPlainObject(value)) {
        value = convertObjectKeysCamelCaseFromSnakeCase(value);
      } else if (isArray(value)) {
        value = value.map((v) => (isPlainObject(v) ? convertObjectKeysCamelCaseFromSnakeCase(v) : v));
      }
      camelCaseObject[convertCamelCaseFromSnakeCase(key)] = value;
    });

    return camelCaseObject;
  }
}

export default convertObjectKeysCamelCaseFromSnakeCase;