document.addEventListener('DOMContentLoaded', () => {
    const helpButton = document.getElementById('helpButton');
    const helpPopup = document.getElementById('helpPopup');

    // Загружаем текст справки из help.txt с отключённым кешированием
    fetch('help.txt', { cache: 'no-store' })
      .then(response => response.text())
      .then(text => {
         helpPopup.innerText = text;
      })
      .catch(() => {
         helpPopup.innerText = "Ошибка загрузки справки.";
      });

    helpButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Предотвращаем закрытие окна
        helpPopup.style.display = (helpPopup.style.display === 'block') ? 'none' : 'block';
    });
    
    // Закрываем окно при клике вне его
    document.addEventListener('click', (e) => {
        if (e.target !== helpButton && !helpPopup.contains(e.target)) {
            helpPopup.style.display = 'none';
        }
    });
});
