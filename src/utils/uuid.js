module.exports = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function (character) {
      const randomByte = (Math.random() * 16) | 0;
      const value = character === 'x' ? randomByte : (randomByte & 0x3) | 0x8;

      return value.toString(16).toLowerCase();
    }
  );
};
