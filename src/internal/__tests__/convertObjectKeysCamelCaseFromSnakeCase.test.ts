import toCamelCase from '../convertObjectKeysCamelCaseFromSnakeCase';

describe('camelCase function test', (): void => {
  it('general object to camelCase', (): void => {
    expect(
      toCamelCase({
        leveltest_srl: 31,
        order: 2,
        expected_start_num: 2,
        expected_end_num: 2,
        expected_start_time: 2,
        expected_end_time: 2,
        ai_accuracy_goal: 2,
        complete: true,
        user_srl: 16,
        leveltest_units: ['2001', '2002'],
      }),
    ).toEqual({
      leveltestSrl: 31,
      order: 2,
      expectedStartNum: 2,
      expectedEndNum: 2,
      expectedStartTime: 2,
      expectedEndTime: 2,
      aiAccuracyGoal: 2,
      complete: true,
      userSrl: 16,
      leveltestUnits: ['2001', '2002'],
    });
  });

  it('change object to camelCase in nested object', (): void => {
    const obj = { a_b_c: { c_c_c: 1, b_b_b: [{ d_d_d: 1 }, 2, 3] } };

    expect(toCamelCase(obj)).toEqual({
      aBC: { cCC: 1, bBB: [{ dDD: 1 }, 2, 3] },
    });
  });

  it('change array to camelCase', (): void => {
    const obj = { a_b_c: { c_c_c: 1, b_b_b: [{ d_d_d: 1 }, 2, 3] } };
    const arr = [obj, obj, obj];

    expect(toCamelCase(arr)).toEqual([
      { aBC: { cCC: 1, bBB: [{ dDD: 1 }, 2, 3] } },
      { aBC: { cCC: 1, bBB: [{ dDD: 1 }, 2, 3] } },
      { aBC: { cCC: 1, bBB: [{ dDD: 1 }, 2, 3] } },
    ]);
  });

  it('change array to camelCase2', (): void => {
    const numberArray = [0, 1, 2, 3, 4];
    expect(toCamelCase(numberArray)).toEqual([0, 1, 2, 3, 4]);

    const stringArray = ['2001', '2002', '2003'];
    expect(toCamelCase(stringArray)).toEqual(['2001', '2002', '2003']);
  });

  it('change object containing non-plain-object to camelCase', (): void => {
    class Class {
      constructor(public name: string, private birth: number) {}

      sayMyName() {
        console.error('My name is ' + this.name);
      }
    }
    const instance = new Class('mj', 1997);

    const obj = { a_b_c: instance };

    expect(toCamelCase(obj)).toEqual({
      aBC: instance,
    });
  });

  it('undefined should return empty object', () => {
    expect(toCamelCase(undefined)).toEqual({});
  });
});
