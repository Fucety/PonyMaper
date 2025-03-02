const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayCtx = overlay.getContext('2d');

const gridCanvas = document.getElementById('grid');
const gridCtx = gridCanvas.getContext('2d');

const savedOverlay = document.getElementById('savedOverlay');
const savedOverlayCtx = savedOverlay.getContext('2d');

let cellSize = parseInt(document.getElementById('cellSize').value);
let gridWidth = parseInt(document.getElementById('gridWidth').value);
let gridHeight = parseInt(document.getElementById('gridHeight').value);
let drawing = false;
let color = document.getElementById('colorPicker').value;
let backgroundColor = document.getElementById('backgroundColorPicker').value;
let cellColor = document.getElementById('cellColorPicker').value;
let erasing = false;
let brushSize = parseInt(document.getElementById('brushSize').value);
let gridThickness = parseFloat(document.getElementById('gridThickness').value); // новая переменная с дробным значением

let selectionMode = false;
let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;

// Добавляем переменную для цвета выделения
let selectionColor = document.getElementById('selectionColorPicker').value;

let instrument = "brush";  // "brush" | "rectangle" | "eraser"
let rectDrawing = false;
let rectStart = null;
let rectEnd = null;

let savedRectangles = [];

// Добавляем массив для хранения сохраненных областей
let savedSelections = [];

let gridLayer = "bottom"; // по умолчанию "под линиями"

// Флаг режима удаления выделения
let deleteSelectionModeActive = false;

/* Новая функция для перерисовки сохранённых прямоугольников */
function redrawRectangles() {
    savedRectangles.forEach(function(rec) {
        ctx.save();
        ctx.fillStyle = rec.color;
        ctx.fillRect(rec.x, rec.y, rec.width, rec.height);
        ctx.restore();
    });
}

// Обновляем обработчик изменения цвета выделения
document.getElementById('selectionColorPicker').addEventListener('input', (e) => {
    selectionColor = e.target.value;
});

function setInstrument(inst) {
    // Если есть активное выделение - отменяем его
    if (selectionMode) {
        selectionMode = false;
        selectionStart = null;
        selectionEnd = null;
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        document.getElementById('selectionInfo').innerText = "";
    }
    
    instrument = inst;
    // Если выбран ластик, включаем режим стирания
    erasing = (inst === 'eraser');
}

// Обновляем размеры всех холстов
function syncCanvasSizes() {
    const width = gridWidth * cellSize;
    const height = gridHeight * cellSize;
    
    // Устанавливаем размеры контейнера
    const container = document.getElementById('canvasContainer');
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    
    // Устанавливаем размеры всех холстов
    [canvas, gridCanvas, overlay, savedOverlay].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
    });
}

// Обновляем функцию drawGridLayer для лучшей видимости сетки
function drawGridLayer() {
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.lineWidth = gridThickness;
    // Используем более контрастный цвет для сетки
    gridCtx.strokeStyle = cellColor;
    gridCtx.translate(0.5, 0.5);
    
    for (let x = 0; x < gridCanvas.width; x += cellSize) {
        for (let y = 0; y < gridCanvas.height; y += cellSize) {
            gridCtx.strokeRect(x, y, cellSize, cellSize);
        }
    }
    gridCtx.restore();
}

// Функция обновления внешнего вида сетки (без изменения размеров и without очистки canvas)
function updateGridAppearance() {
    // Считываем актуальное значение из селектора
    gridLayer = document.getElementById('gridLayer').value;
    if (gridLayer === "top") {
        canvas.style.backgroundColor = backgroundColor;
        document.getElementById('canvasContainer').style.backgroundColor = 'transparent';
        // Для режима "поверх всего" gridCanvas должен быть выше canvas
        gridCanvas.style.zIndex = '5';
        canvas.style.zIndex = '3';
        overlay.style.zIndex = '6';
    } else {
        canvas.style.backgroundColor = 'transparent';
        document.getElementById('canvasContainer').style.backgroundColor = backgroundColor;
        // Для режима "под линиями" gridCanvas ниже рисунка
        gridCanvas.style.zIndex = '1';
        canvas.style.zIndex = '2';
        overlay.style.zIndex = '3';
    }
    drawGridLayer();
}

/* Изменяем функцию updateGridLayer() – теперь она обновляет только внешний вид */
function updateGridLayer() {
    updateGridAppearance();
}

/* Функция обновления размеров доски (это действительно может стереть кисточные рисунки) */
function updateGridDimensions() {
    saveDrawingData(); // Сохраняем нарисованное
    syncCanvasSizes();
    // Перерисовываем сохранённые прямоугольники (инструмент прямоугольник)
    redrawRectangles();
    drawGridLayer();
    restoreDrawingData(); // Восстанавливаем нарисованное
    // Не очищаем savedOverlay – сохранённые области остаются.
}

/* Изменяем функцию drawGrid, чтобы использовать новый gridCanvas */
function drawGrid() {
    syncCanvasSizes();
    redrawRectangles();
    drawGridLayer();
}

function getGridPosition(x, y) {
    return {
        x: Math.floor(x / cellSize) * cellSize,
        y: Math.floor(y / cellSize) * cellSize
    };
}

canvas.addEventListener('mousedown', (e) => {
    if (selectionMode) {
        isSelecting = true;
        const rect = canvas.getBoundingClientRect();
        selectionStart = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
    }
    else if (instrument === 'rectangle') {
        rectDrawing = true;
        const rectElem = canvas.getBoundingClientRect();
        rectStart = {
            x: Math.floor((e.clientX - rectElem.left) / cellSize),
            y: Math.floor((e.clientY - rectElem.top) / cellSize)
        };
    }
    else { // Для кисточки или ластика
        drawing = true;
        draw(e);
    }
});

/* Изменяем обработчик мыши для инструмента "rectangle" */
canvas.addEventListener('mouseup', (e) => {
    if (selectionMode && isSelecting) {
        isSelecting = false;
        const rect = canvas.getBoundingClientRect();
        selectionEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        const width = Math.abs(selectionEnd.x - selectionStart.x) + 1;
        const height = Math.abs(selectionEnd.y - selectionStart.y) + 1;
        document.getElementById('selectionInfo').innerText = `Область: ${width} x ${height} клеток`;
        drawSelectionOverlay();
    }
    else if (instrument === 'rectangle' && rectDrawing) {
        rectDrawing = false;
        const rectElem = canvas.getBoundingClientRect();
        rectEnd = {
            x: Math.floor((e.clientX - rectElem.left) / cellSize),
            y: Math.floor((e.clientY - rectElem.top) / cellSize)
        };
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        let startX = Math.min(rectStart.x, rectEnd.x) * cellSize;
        let startY = Math.min(rectStart.y, rectEnd.y) * cellSize;
        let endX = (Math.max(rectStart.x, rectEnd.x) + 1) * cellSize;
        let endY = (Math.max(rectStart.y, rectEnd.y) + 1) * cellSize;
        let rec = {
            x: startX,
            y: startY,
            width: endX - startX,
            height: endY - startY,
            color: erasing ? backgroundColor : color
        };
        savedRectangles.push(rec);
        // Вместо drawGrid() вызываем непосредственное рисование прямоугольника:
        ctx.save();
        ctx.fillStyle = rec.color;
        ctx.fillRect(rec.x, rec.y, rec.width, rec.height);
        ctx.restore();
    }
    else if (!selectionMode) {
        drawing = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (selectionMode && isSelecting) {
        const rect = canvas.getBoundingClientRect();
        selectionEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        updateGridAppearance(); // Обновляем только сетку
        drawSelectionOverlay();
    }
    else if (instrument === 'rectangle' && rectDrawing) {
        const rectElem = canvas.getBoundingClientRect();
        rectEnd = {
            x: Math.floor((e.clientX - rectElem.left) / cellSize),
            y: Math.floor((e.clientY - rectElem.top) / cellSize)
        };
        updateGridAppearance(); // Обновляем только сетку
        drawRectOverlay();
    }
    else if (!selectionMode) {
        draw(e);
    }
});

/* ...existing code... */

// Функция проверки пересечения двух прямоугольников
function rectsOverlap(r1, r2) {
	return !(r2.x >= r1.x + r1.w || 
	         r2.x + r2.w <= r1.x || 
	         r2.y >= r1.y + r1.h || 
	         r2.y + r2.h <= r1.y);
}

// Проверка: защищена ли ячейка (x,y, cellSize, cellSize) сохранённой областью
function isCellProtected(x, y) {
    let cell = { x: x, y: y, w: cellSize, h: cellSize };
    return savedSelections.some(sel => {
        let selRect = { x: sel.startX, y: sel.startY, w: sel.width, h: sel.height };
        return rectsOverlap(cell, selRect);
    });
}

// Обновляем функцию draw, используя защитную проверку
function draw(e) {
    if (!drawing) return;
    const rectElem = canvas.getBoundingClientRect();
    const startX = e.clientX - rectElem.left;
    const startY = e.clientY - rectElem.top;
    const effectiveBrush = brushSize - 1;
    
    ctx.save();
    for (let dx = -effectiveBrush; dx <= effectiveBrush; dx++) {
        for (let dy = -effectiveBrush; dy <= effectiveBrush; dy++) {
            let { x, y } = getGridPosition(startX + dx * cellSize, startY + dy * cellSize);
            if (isCellProtected(x, y)) continue; // Пропускаем, если ячейка защищена

            if (erasing && gridLayer === "bottom") {
                ctx.clearRect(x, y, cellSize, cellSize);
            } else {
                ctx.fillStyle = erasing ? backgroundColor : color;
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }
    ctx.restore();
    // savedOverlay не изменяется
}

/* ...existing code... */

function drawSelectionOverlay() {
    if (!selectionStart || !selectionEnd) return;
    // Очищаем overlay‑холст, чтобы не оставались старые рисунки
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    let startX = Math.min(selectionStart.x, selectionEnd.x) * cellSize;
    let startY = Math.min(selectionStart.y, selectionEnd.y) * cellSize;
    let endX = (Math.max(selectionStart.x, selectionEnd.x) + 1) * cellSize;
    let endY = (Math.max(selectionStart.y, selectionEnd.y) + 1) * cellSize;
    
    overlayCtx.save();
    overlayCtx.strokeStyle = selectionColor;  // Используем выбранный цвет
    overlayCtx.lineWidth = gridThickness; // Используем ту же толщину
    overlayCtx.setLineDash([5, 3]);
    overlayCtx.strokeRect(startX, startY, endX - startX, endY - startY);
    
    // Вычисляем размеры области в клетках
    let cellsWidth = Math.abs(selectionEnd.x - selectionStart.x) + 1;
    let cellsHeight = Math.abs(selectionEnd.y - selectionStart.y) + 1;
    let text = `Область: ${cellsWidth} x ${cellsHeight}`;

    // Настройка текста
    overlayCtx.setLineDash([]);
    overlayCtx.font = "bold 20px sans-serif";  // Увеличили шрифт
    overlayCtx.fillStyle = selectionColor;      // Используем тот же цвет для текста
    // Рисуем текст чуть выше выделенной области, если позволяет место
    let textX = startX;
    let textY = startY > 25 ? startY - 5 : endY + 25;
    overlayCtx.fillText(text, textX, textY);
    
    overlayCtx.restore();
}

function saveSelection() {
    if (!selectionStart || !selectionEnd) return;
    
    let startX = Math.min(selectionStart.x, selectionEnd.x) * cellSize;
    let startY = Math.min(selectionStart.y, selectionEnd.y) * cellSize;
    let endX = (Math.max(selectionStart.x, selectionEnd.x) + 1) * cellSize;
    let endY = (Math.max(selectionStart.y, selectionEnd.y) + 1) * cellSize;
    
    // Сохраняем область в массив
    savedSelections.push({
        startX, startY,
        width: endX - startX,
        height: endY - startY,
        color: selectionColor,
        text: `Область: ${Math.abs(selectionEnd.x - selectionStart.x) + 1} x ${Math.abs(selectionEnd.y - selectionStart.y) + 1}`
    });

    // Очищаем и перерисовываем все сохранённые области
    redrawSavedSelections();
    
    // Сброс режима выделения
    selectionMode = false;
    selectionStart = null;
    selectionStart = null;
    selectionEnd = null;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
}

function drawSavedSelection(selection) {
    savedOverlayCtx.save();
    savedOverlayCtx.strokeStyle = selection.color;
    savedOverlayCtx.lineWidth = gridThickness * 2;
    savedOverlayCtx.setLineDash([]);
    savedOverlayCtx.strokeRect(selection.startX, selection.startY, selection.width, selection.height);

    savedOverlayCtx.font = "bold 20px sans-serif";
    savedOverlayCtx.fillStyle = selection.color;
    let textY = selection.startY > 25 ? selection.startY - 5 : selection.startY + selection.height + 25;
    savedOverlayCtx.fillText(selection.text, selection.startX, textY);
    savedOverlayCtx.restore();
}

function redrawSavedSelections() {
    // Очищаем savedOverlay перед перерисовкой
    savedOverlayCtx.clearRect(0, 0, savedOverlay.width, savedOverlay.height);
    savedSelections.forEach(selection => drawSavedSelection(selection));
}

function deleteSelectionMode() {
    deleteSelectionModeActive = true;
    document.getElementById('selectionInfo').innerText = "Выберите область для удаления";
}

canvas.addEventListener('click', (e) => {
    if (!deleteSelectionModeActive) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Ищем область под кликом
    const index = savedSelections.findIndex(selection => 
        x >= selection.startX && x <= selection.startX + selection.width &&
        y >= selection.startY && y <= selection.startY + selection.height
    );
    
    if (index !== -1) {
        savedSelections.splice(index, 1);
        // Перерисовываем все сохранённые области без очистки основного canvas
        redrawSavedSelections();
        document.getElementById('selectionInfo').innerText = "Область удалена";
        deleteSelectionModeActive = false;
    }
});

function saveSelection() {
    if (!selectionStart || !selectionEnd) return;
    // Вычисляем координаты выделенной области
    let startX = Math.min(selectionStart.x, selectionEnd.x) * cellSize;
    let startY = Math.min(selectionStart.y, selectionEnd.y) * cellSize;
    let endX = (Math.max(selectionStart.x, selectionEnd.x) + 1) * cellSize;
    let endY = (Math.max(selectionStart.y, selectionEnd.y) + 1) * cellSize;
    
    // Рисуем постоянную рамку выделения на основном canvas с большей толщиной
    ctx.save();
    ctx.strokeStyle = selectionColor;
    // Увеличиваем толщину рамки, например, в 2 раза от gridThickness или фиксированное значение
    ctx.lineWidth = gridThickness * 2; 
    ctx.setLineDash([]); // убираем пунктир
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    
    // Вычисляем параметры выделенной области
    let cellsWidth = Math.abs(selectionEnd.x - selectionStart.x) + 1;
    let cellsHeight = Math.abs(selectionEnd.y - selectionStart.y) + 1;
    let text = `Область: ${cellsWidth} x ${cellsHeight}`;
    // Отображаем текст с более крупным и жирным шрифтом
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = selectionColor;
    // Текст рисуем чуть выше рамки, если позволяет место
    let textY = startY > 25 ? startY - 5 : endY + 25;
    ctx.fillText(text, startX, textY);
    ctx.restore();
    
    console.log("Сохранённая выделенная область:", {startX, startY, width: endX - startX, height: endY - endY});
    // Сброс режима выделения
    selectionMode = false;
    selectionStart = null;
    selectionEnd = null;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
}

/* Изменяем функцию drawRectOverlay для показа размера прямоугольника */
function drawRectOverlay() {
    if (!rectStart || !rectEnd) return;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    let startX = Math.min(rectStart.x, rectEnd.x) * cellSize;
    let startY = Math.min(rectStart.y, rectEnd.y) * cellSize;
    let endX = (Math.max(rectStart.x, rectEnd.x) + 1) * cellSize;
    let endY = (Math.max(rectStart.y, rectEnd.y) + 1) * cellSize;
    overlayCtx.save();
    overlayCtx.strokeStyle = 'red';
    overlayCtx.lineWidth = gridThickness; // Используем ту же толщину
    overlayCtx.setLineDash([5, 3]);
    overlayCtx.strokeRect(startX, startY, endX - startX, endY - startY);
    // Вычисляем размеры в клетках и отображаем текст
    let cellsWidth = Math.abs(rectEnd.x - rectStart.x) + 1;
    let cellsHeight = Math.abs(rectEnd.y - rectStart.y) + 1;
    let text = `Размер: ${cellsWidth} x ${cellsHeight}`;
    overlayCtx.setLineDash([]);
    overlayCtx.font = "16px sans-serif";
    overlayCtx.fillStyle = "red";
    let textX = startX;
    let textY = startY > 20 ? startY - 5 : endY + 20;
    overlayCtx.fillText(text, textX, textY);
    overlayCtx.restore();
}

document.getElementById('colorPicker').addEventListener('input', (e) => {
    color = e.target.value;
    erasing = false;
});

document.getElementById('brushSize').addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
});

function setEraser() {
    erasing = true;
}

// Изменяем clearCanvas: не очищаем savedOverlay
function clearCanvas() {
    savedRectangles = [];
    
    if (gridLayer === "top") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawGrid();
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    // Не очищаем savedOverlay – оставляем сохранённые области нетронутыми
    // (Удаляем вызов savedOverlayCtx.clearRect(...))
}

function saveCanvas() {
    // Создаём временный canvas для объединения всех слоёв
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Заливаем фон
    tempCtx.fillStyle = backgroundColor;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Рисуем сетку, если она находится снизу
    if (gridLayer === "bottom") {
        tempCtx.save();
        tempCtx.lineWidth = gridThickness;
        tempCtx.strokeStyle = cellColor;
        tempCtx.translate(0.5, 0.5);
        for (let x = 0; x < tempCanvas.width; x += cellSize) {
            for (let y = 0; y < tempCanvas.height; y += cellSize) {
                tempCtx.strokeRect(x, y, cellSize, cellSize);
            }
        }
        tempCtx.restore();
    }

    // Копируем содержимое основного canvas
    tempCtx.drawImage(canvas, 0, 0);

    // Рисуем сетку, если она находится сверху
    if (gridLayer === "top") {
        tempCtx.save();
        tempCtx.lineWidth = gridThickness;
        tempCtx.strokeStyle = cellColor;
        tempCtx.translate(0.5, 0.5);
        for (let x = 0; x < tempCanvas.width; x += cellSize) {
            for (let y = 0; y < tempCanvas.height; y += cellSize) {
                tempCtx.strokeRect(x, y, cellSize, cellSize);
            }
        }
        tempCtx.restore();
    }

    // Создаём ссылку для скачивания
    const link = document.createElement('a');
    link.download = 'map-paint.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

function changeTheme() {
    const theme = document.getElementById('themeSelector').value;
    document.body.style.backgroundColor = theme === 'dark' ? '#333' : '#fff';
    document.body.style.color = theme === 'dark' ? '#fff' : '#000';
}

// Пример: функция changeCellColor() теперь вызывает updateGridLayer(), чтобы не стирать кисточку
function changeCellColor() {
    cellColor = document.getElementById('cellColorPicker').value;
    updateGridAppearance(); // Обновляем только сетку
}

// Аналогично, функция changeBackground() не вызывает очистку canvas
function changeBackground() {
    backgroundColor = document.getElementById('backgroundColorPicker').value;
    if (gridLayer === "top") {
        canvas.style.backgroundColor = backgroundColor;
        document.getElementById('canvasContainer').style.backgroundColor = "transparent";
    } else {
        canvas.style.backgroundColor = "transparent";
        document.getElementById('canvasContainer').style.backgroundColor = backgroundColor;
    }
    updateGridAppearance(); // Обновляем только сетку
}

// Функция resizeCanvas() – изменения размеров вызывают полное обновление (это допустимо)
function resizeCanvas() {
    gridWidth = parseInt(document.getElementById('gridWidth').value);
    gridHeight = parseInt(document.getElementById('gridHeight').value);
    cellSize = parseInt(document.getElementById('cellSize').value);
    gridThickness = parseFloat(document.getElementById('gridThickness').value); // обновляем толщину сетки
    updateGridDimensions(); // Это может стереть кисточку (из-за смены размеров)
}

function activateSelectionMode() {
    selectionMode = true;
    document.getElementById('selectionInfo').innerText = "Выберите область";
}

// Добавляем функцию для сохранения/восстановления состояния canvas
let drawingData = null; // Для хранения нарисованного

// Функция сохранения нарисованного
function saveDrawingData() {
    drawingData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Функция восстановления нарисованного
function restoreDrawingData() {
    if (drawingData) {
        ctx.putImageData(drawingData, 0, 0);
    }
}

// При загрузке страницы обновляем только внешний вид
window.addEventListener('load', function() {
    updateGridLayer();
    // Вызываем updateGridDimensions() только если размеры реально нужно задать,
    // иначе кисточными рисунки сохраняются
});

drawGrid();
changeTheme();
