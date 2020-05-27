import convertJsonKeys from './convertJsonKeys';

it('simple', () => {
  expect(convertJsonKeys({ a: 1 }, { a: 'b' })).toEqual({ b: 1 });

  expect(convertJsonKeys([1, 2, 3, 4, 5], { a: 'b' })).toEqual([1, 2, 3, 4, 5]);

  expect(convertJsonKeys([1, 2, 3, 4, 5], { 0: '1' })).toEqual([1, 2, 3, 4, 5]);
});

it('complex', () => {
  expect(
    convertJsonKeys(
      {
        current_user_high_ratio_100: 99.7,
        after_user_high_ratio_100: 99.1,
        need_problem_number: 2,
        is_problem_exist: true,
      },
      { current_user_high_ratio_100: 'userHighRatio' },
    ),
  ).toEqual({
    userHighRatio: 99.7,
    after_user_high_ratio_100: 99.1,
    need_problem_number: 2,
    is_problem_exist: true,
  });

  expect(
    convertJsonKeys(
      {
        demotest_srl: 2, // interger, Non-Nullable
        demotest_order: 2, // interger, Non-Nullable
        demotest_problems: [
          {
            demotest_problem_order: 1, // interger, Non-Nullable
            problem_start_unix_time: null, // integer, Nullable
            problem_submitted_unix_time: null, // integer, Nullable
            user_answer: null, // string, Nullable
            user_time_sec: null, // interger, Nullable
            demotest_problem_srl: 12, // integer, Non-Nullable
            problem: {
              info: {
                problem_srl: 632, // integer, Non-Nullable
                answer_type: 1, // integer, Non-Nullable, 1: 주관식, 2: 객관식
                answer: '-1', // string, Non-Nullable
                correct_rate: 97.2, // float, Non-Nullable
                unit_d_name: '복소수의 뜻과 사칙연산', // string, Non-Nullable
                solving_expected_time_sec: 70, // integer, Non-Nullable
              },
              question: {
                choices: [], // Array[string], Non-Nullable
                render: {
                  images: [], // Array[string], Non-Nullable
                  texts: [
                    '$(-2+4i)-3i=a+bi$일 때, 두 정수 $a,\\ b$에 대하여 $a+b$의 값을 구하시오. $($단, $i=\\sqrt{-1}$ 이다.$)$\n',
                  ], // Array[string], Non-Nullable
                  conditions: [], // Array[string], Non-Nullable
                  order: 'T', // string, Non-Nullable
                },
              },
              explain: {
                render: {
                  images: [], // Array[string], Non-Nullable
                  texts: ['$(-2+4 i)-3 i=-2+(4-3) i=-2+i$\n$a=-2,\\ b=1\\qquad\\therefore\\ a+b=-1$'], // Array[string], Non-Nullable
                  order: 'T', // string, Non-Nullable
                },
              },
            },
          },
        ],
      },
      { demotest_srl: 'demotestSrl', demotest_problems: 'problems', answer: 'myAnswer', unit_d_name: 'name' },
    ),
  ).toEqual({
    demotestSrl: 2, // interger, Non-Nullable
    demotest_order: 2, // interger, Non-Nullable
    problems: [
      {
        demotest_problem_order: 1, // interger, Non-Nullable
        problem_start_unix_time: null, // integer, Nullable
        problem_submitted_unix_time: null, // integer, Nullable
        user_answer: null, // string, Nullable
        user_time_sec: null, // interger, Nullable
        demotest_problem_srl: 12, // integer, Non-Nullable
        problem: {
          info: {
            problem_srl: 632, // integer, Non-Nullable
            answer_type: 1, // integer, Non-Nullable, 1: 주관식, 2: 객관식
            myAnswer: '-1', // string, Non-Nullable
            correct_rate: 97.2, // float, Non-Nullable
            name: '복소수의 뜻과 사칙연산', // string, Non-Nullable
            solving_expected_time_sec: 70, // integer, Non-Nullable
          },
          question: {
            choices: [], // Array[string], Non-Nullable
            render: {
              images: [], // Array[string], Non-Nullable
              texts: [
                '$(-2+4i)-3i=a+bi$일 때, 두 정수 $a,\\ b$에 대하여 $a+b$의 값을 구하시오. $($단, $i=\\sqrt{-1}$ 이다.$)$\n',
              ], // Array[string], Non-Nullable
              conditions: [], // Array[string], Non-Nullable
              order: 'T', // string, Non-Nullable
            },
          },
          explain: {
            render: {
              images: [], // Array[string], Non-Nullable
              texts: ['$(-2+4 i)-3 i=-2+(4-3) i=-2+i$\n$a=-2,\\ b=1\\qquad\\therefore\\ a+b=-1$'], // Array[string], Non-Nullable
              order: 'T', // string, Non-Nullable
            },
          },
        },
      },
    ],
  });
});
