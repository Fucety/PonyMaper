// Шорткаты для переключения инструментов, изменения размера кисти (shift+wheel) и отмены последнего действия (ctrl+z)

// Массив для хранения состояний активного слоя (undo)
let undoStack = [];

// Функция сохранения текущего состояния активного слоя
function pushUndoState() {
    if (typeof getActiveLayer === 'function') {
        const activeLayer = getActiveLayer();
        if (activeLayer && activeLayer.ctx) {
            const state = activeLayer.ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            undoStack.push(state);
            if (undoStack.length > 20) {
                undoStack.shift();
            }
        }
    }
}

// Функция отмены последнего действия (восстанавливаем состояние активного слоя)
function undoLastAction() {
    if (undoStack.length > 0 && typeof getActiveLayer === 'function') {
        const previousState = undoStack.pop();
        const activeLayer = getActiveLayer();
        if (activeLayer && activeLayer.ctx) {
            activeLayer.ctx.putImageData(previousState, 0, 0);
        }
        redrawAllLayers();
        // Обновляем кеш новым состоянием после отмены,
        // чтобы при перезагрузке страницы не возвращались отменённые изменения.
        saveProgressToCache();
    }
}

// Обработчик глобальных клавиатурных шорткатов
document.addEventListener('keydown', (e) => {
    // Если фокус в инпуте или textarea — пропускаем
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // Отмена действия: проверяем комбинацию ctrl/meta + KeyZ по e.code
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undoLastAction();
        return;
    }

    // Другие шорткаты
    // Используем event.code для работы независимо от раскладки
    switch(e.code) {
        case 'Digit1':
            setInstrument('brush');
            break;
        case 'Digit2':
            setInstrument('rectangle');
            break;
        case 'Digit3':
            setInstrument('line');
            break;
        case 'KeyE':
            setInstrument('eraser');
            break;
        case 'KeyR':
            setInstrument('selection');
            break;
    }
});

// Обработка события колёсика: если зажата клавиша Shift, изменяем размер кисти
document.addEventListener('wheel', (e) => {
    if (e.shiftKey) {
        e.preventDefault();
        // deltaY: >0 вниз, <0 вверх
        const delta = Math.sign(e.deltaY);
        // Изменяем brushSize, не опускаем ниже 1
        brushSize = Math.max(1, brushSize - delta);
        // Обновляем элемент управления
        const bsInput = document.getElementById('brushSize');
        if (bsInput) {
            bsInput.value = brushSize;
        }
    }
});
