export default function convertJsonKeys(json: any, serializedNames: { [P in string]: string }): any {
  let jsonString = JSON.stringify(json);

  Object.entries(serializedNames).forEach(([original, serialized]) => {
    const regex = new RegExp(`\"${original}\":`, 'g');
    jsonString = jsonString.replace(regex, `\"${serialized}\":`);
  });

  return JSON.parse(jsonString);
}
