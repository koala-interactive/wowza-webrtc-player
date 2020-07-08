Array.from(document.querySelectorAll('input')).forEach((element) => {
  const name = element.name;

  element.value = localStorage.getItem(name) || '';
  element.addEventListener(
    'change',
    function () {
      localStorage.setItem(name, element.value);
    },
    false
  );
});
