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

// Добавляем переменную для цвета выделения
let selectionColor = document.getElementById('selectionColorPicker').value;

let instrument = "brush";  // "brush" | "eraser" | "rectangle"

// Добавляем переменные для инструмента "rectangle"
let isDrawingRectangle = false;
let rectangleStart = null;
let rectangleEnd = null;

let savedRectangles = [];

// Добавляем массив для хранения сохраненных областей
let savedSelections = [];

let gridLayer = "bottom"; // по умолчанию "под линиями"

// Флаг режима удаления выделения
let deleteSelectionModeActive = false;

// Добавляем переменные для выделения после существующих переменных
let selectionActive = false;
let selectionStart = null;
let selectionEnd = null;
let selectedArea = null; // Хранит информацию о выделенной области для текущего слоя

// Добавляем флаг для отслеживания состояния выделения
let isSelectingActive = false;

// Переименовываем переменные для инструмента "Линия"
let lineDrawing = false;
let lineStart = null;
let lineEnd = null;

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
// document.getElementById('selectionColorPicker').addEventListener('input', (e) => {
//     selectionColor = e.target.value;
// });

// Добавляем функцию для получения ближайшей точки пересечения с сеткой
function getGridIntersection(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    return {
        x: Math.round(mouseX / cellSize) * cellSize,
        y: Math.round(mouseY / cellSize) * cellSize
    };
}

function setInstrument(inst) {
    instrument = inst;
    if (inst !== 'selection') {
        clearSelection();
        selectionActive = false;
    }
    erasing = (inst === 'eraser');
    if(inst === 'line'){
        lineDrawing = false;
        lineStart = null;
        lineEnd = null;
    }
    /* Добавляем обновление подсветки */
    updateToolHighlight();
}

/* Новая функция для подсветки активного инструмента */
function updateToolHighlight() {
    const tools = ['brush', 'rectangle', 'line', 'eraser'];
    tools.forEach(t => {
        const btn = document.getElementById('tool' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            if (instrument === t) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// Функция очистки выделения
function clearSelection() {
    selectionStart = null;
    selectionEnd = null;
    selectedArea = null;
    isSelectingActive = false;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
}

// Добавляем функцию для активации инструмента выделения
function activateSelectionTool() {
    instrument = 'selection';
    selectionActive = true;
    // Очищаем предыдущее выделение
    clearSelection();
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
    const rect = canvas.getBoundingClientRect();
    // Сохраняем состояние активного слоя для всех действий, изменяющих рисунок
    if (instrument !== 'selection') {
        if (typeof pushUndoState === 'function') {
            pushUndoState();
        }
    }
    if (instrument === 'selection') {
        if (!isSelectingActive) {
            // Первый клик - начинаем выделение
            isSelectingActive = true;
            selectionStart = {
                x: Math.floor((e.clientX - rect.left) / cellSize),
                y: Math.floor((e.clientY - rect.top) / cellSize)
            };
            selectionEnd = {...selectionStart};
        } else {
            // Второй клик - фиксируем выделение
            const currentLayer = getActiveLayer();
            if (!currentLayer.isFolder) {
                selectedArea = {
                    layer: currentLayer,
                    startX: Math.min(selectionStart.x, selectionEnd.x),
                    startY: Math.min(selectionStart.y, selectionEnd.y),
                    endX: Math.max(selectionStart.x, selectionEnd.x),
                    endY: Math.max(selectionStart.y, selectionEnd.y)
                };
            }
            isSelectingActive = false; // Завершаем процесс выделения
        }
    } else if (instrument === 'rectangle') {
        isDrawingRectangle = true;
        rectangleStart = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
    } else if (instrument === 'line') {
        lineDrawing = true;
        lineStart = getGridIntersection(e);
    } else {
        drawing = true;
        draw(e);
    }
});

canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (instrument === 'selection') {
        if (selectionStart && selectionEnd && !selectedArea) {
            const currentLayer = getActiveLayer();
            if (!currentLayer.isFolder) {
                selectedArea = {
                    layer: currentLayer,
                    startX: Math.min(selectionStart.x, selectionEnd.x),
                    startY: Math.min(selectionStart.y, selectionEnd.y),
                    endX: Math.max(selectionStart.x, selectionEnd.x),
                    endY: Math.max(selectionStart.y, selectionEnd.y)
                };
                // Оставляем контур выделения на экране
                drawSelectionOverlay();
            }
        }
    } else if (instrument === 'rectangle' && isDrawingRectangle) {
        isDrawingRectangle = false;
        rectangleEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        let startX = Math.min(rectangleStart.x, rectangleEnd.x) * cellSize;
        let startY = Math.min(rectangleStart.y, rectangleEnd.y) * cellSize;
        let width = (Math.abs(rectangleEnd.x - rectangleStart.x) + 1) * cellSize;
        let height = (Math.abs(rectangleEnd.y - rectangleStart.y) + 1) * cellSize;
        const currentLayer = getActiveLayer();
        currentLayer.ctx.save();
        currentLayer.ctx.fillStyle = color;
        currentLayer.ctx.fillRect(startX, startY, width, height);
        currentLayer.ctx.restore();
        currentLayer.rectangles.push({ x: startX, y: startY, width, height, color });
        redrawAllLayers();
        rectangleStart = null;
        rectangleEnd = null;
        saveProgressToCache(); // Сохраняем прогресс после рисования прямоугольника
    } else if (instrument === 'line' && lineDrawing) {
        lineDrawing = false;
        lineEnd = getGridIntersection(e);
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        const currentLayer = getActiveLayer();
        currentLayer.ctx.save();
        currentLayer.ctx.strokeStyle = color;
        currentLayer.ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
        currentLayer.ctx.beginPath();
        currentLayer.ctx.moveTo(lineStart.x, lineStart.y);
        currentLayer.ctx.lineTo(lineEnd.x, lineEnd.y);
        currentLayer.ctx.stroke();
        currentLayer.ctx.restore();
        redrawAllLayers();
        saveProgressToCache(); // Сохраняем прогресс после отрисовки линии
    } else {
        drawing = false;
        // Если завершилось рисование кистью, сохраняем прогресс
        if (instrument === 'brush' || instrument === 'eraser') {
            saveProgressToCache();
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (instrument === 'selection' && isSelectingActive) {
        selectionEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        drawSelectionOverlay();
    } else if (instrument === 'rectangle' && isDrawingRectangle) {
        rectangleEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        // Превью прямоугольника с выводом размера
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        let startX = Math.min(rectangleStart.x, rectangleEnd.x) * cellSize;
        let startY = Math.min(rectangleStart.y, rectangleEnd.y) * cellSize;
        let width = (Math.abs(rectangleEnd.x - rectangleStart.x) + 1) * cellSize;
        let height = (Math.abs(rectangleEnd.y - rectangleStart.y) + 1) * cellSize;
        overlayCtx.save();
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = gridThickness;
        overlayCtx.setLineDash([5, 3]);
        overlayCtx.strokeRect(startX, startY, width, height);
        // Вывод размера в клетках (превью)
        let cellsWidth = Math.abs(rectangleEnd.x - rectangleStart.x) + 1;
        let cellsHeight = Math.abs(rectangleEnd.y - rectangleStart.y) + 1;
        overlayCtx.font = "bold 14px sans-serif";
        overlayCtx.fillStyle = "black";
        let textY = startY > 20 ? startY - 5 : startY + height + 20;
        overlayCtx.fillText(`Размер: ${cellsWidth} x ${cellsHeight}`, startX, textY);
        overlayCtx.restore();
    } else if (instrument === 'line' && lineDrawing) {
        lineEnd = getGridIntersection(e);
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        overlayCtx.save();
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = gridThickness;
        overlayCtx.setLineDash([5, 3]);
        overlayCtx.beginPath();
        overlayCtx.moveTo(lineStart.x, lineStart.y);
        overlayCtx.lineTo(lineEnd.x, lineEnd.y);
        overlayCtx.stroke();
        overlayCtx.restore();
    } else if (instrument !== 'rectangle') {
        draw(e);
    }
});

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
    
    const currentLayer = getActiveLayer();
    currentLayer.ctx.save();
    for (let dx = -effectiveBrush; dx <= effectiveBrush; dx++) {
        for (let dy = -effectiveBrush; dy <= effectiveBrush; dy++) {
            let { x, y } = getGridPosition(startX + dx * cellSize, startY + dy * cellSize);
            if (isCellProtected(x, y)) continue; // Пропускаем, если ячейка защищена

            if (erasing && gridLayer === "bottom") {
                currentLayer.ctx.clearRect(x, y, cellSize, cellSize);
            } else {
                currentLayer.ctx.fillStyle = erasing ? backgroundColor : color;
                currentLayer.ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }
    currentLayer.ctx.restore();
    redrawAllLayers();
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
    
    // Очищаем кеш – удаляем все сохранённые данные
    localStorage.removeItem('gridPainterProgress');
    localStorage.removeItem('gridPainterLayers');
    localStorage.removeItem('gridPainterSettings');
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
        drawGridOnContext(tempCtx);
    }

    // Копируем содержимое основного canvas
    tempCtx.drawImage(canvas, 0, 0);

    // Добавляем все сохранённые выделения
    function drawAllSelections(items) {
        items.forEach(layer => {
            if (layer.isFolder && layer.layers) {
                drawAllSelections(layer.layers);
            } else if (layer.selections) {
                layer.selections.forEach(selection => {
                    // Рисуем рамку региона
                    tempCtx.save();
                    tempCtx.strokeStyle = selection.color;
                    tempCtx.lineWidth = 2;
                    tempCtx.setLineDash([5, 3]);
                    tempCtx.strokeRect(
                        selection.startX,
                        selection.startY,
                        selection.width,
                        selection.height
                    );

                    // Добавляем подпись
                    tempCtx.font = '12px Arial';
                    tempCtx.fillStyle = selection.color;
                    const text = `${selection.name} (${selection.dimensions})`;
                    const textY = selection.startY > 20 ? 
                        selection.startY - 5 : 
                        selection.startY + selection.height + 15;
                    
                    tempCtx.fillText(text, selection.startX, textY);
                    tempCtx.restore();
                });
            }
        });
    }

    // Рисуем все регионы
    drawAllSelections(layers);

    // Рисуем сетку, если она находится сверху
    if (gridLayer === "top") {
        drawGridOnContext(tempCtx);
    }

    // Создаём ссылку для скачивания
    const link = document.createElement('a');
    link.download = 'map-paint.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

// Вспомогательная функция для отрисовки сетки на указанном контексте
function drawGridOnContext(context) {
    context.save();
    context.lineWidth = gridThickness;
    context.strokeStyle = cellColor;
    context.translate(0.5, 0.5);
    for (let x = 0; x < canvas.width; x += cellSize) {
        for (let y = 0; y < canvas.height; y += cellSize) {
            context.strokeRect(x, y, cellSize, cellSize);
        }
    }
    context.restore();
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

// function activateSelectionMode() {
//     selectionMode = true;
//     document.getElementById('selectionInfo').innerText = "Выберите область";
// }

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
    loadProgressFromCache();
});

drawGrid();
changeTheme();

let layers = [];
let currentLayerIndex = 0;
let layerCounter = 1;
let folderCounter = 1;

/* Добавляем базовый слой для рисования */
createLayer("Базовый слой");
selectLayer(0);

// Единая функция getActiveLayer для работы с вложенными слоями.
// Пусть currentLayerIndex всегда будет массивом пути, например: [0, "layers", 1]
function getActiveLayer() {
    if (!Array.isArray(currentLayerIndex)) {
        return layers[currentLayerIndex];
    }
    let cur = layers;
    for (let i = 0; i < currentLayerIndex.length; i++) {
        const idx = currentLayerIndex[i];
        if (idx === 'layers') continue;
        if (!cur[idx]) {
            console.error('Layer not found:', currentLayerIndex);
            return layers[0];
        }
        cur = cur[idx];
    }
    // Если активный элемент – папка с дочерними слоями, выбираем последний из них
    if (cur.isFolder && Array.isArray(cur.layers) && cur.layers.length > 0) {
        return cur.layers[cur.layers.length - 1];
    }
    return cur;
}

function createLayer(name = `Слой ${layerCounter++}`) {
    const layer = {
        name,
        canvas: document.createElement('canvas'),
        ctx: null,
        visible: true,
        parent: null,
        rectangles: [],
        selections: []
    };
    layer.canvas.width = canvas.width;
    layer.canvas.height = canvas.height;
    layer.ctx = layer.canvas.getContext('2d');
    // Добавляем новый слой в начало массива
    layers.unshift(layer);
    updateLayerList();
    // Выбираем новый слой как текущий
    selectLayer([0]);
    return layer;
}

function createFolder(name = `Папка ${folderCounter++}`) {
    const folder = {
        name,
        layers: [],
        isFolder: true,
        visible: true,
        parent: null
    };
    // Добавляем папку в начало массива
    layers.unshift(folder);
    updateLayerList();
    // Выбираем новый элемент как текущий
    selectLayer([0]);
    return folder;
}

// Изменяем updateLayerList для поддержки перетаскивания и вложенности:

function updateLayerList() {
    const layerList = document.getElementById('layerList');
    layerList.innerHTML = '';
    layers.forEach((item, index) => {
        if (item.isFolder) {
            if (!item.folderColor) {
                const colors = ['#7f8c8d', '#95a5a6', '#bdc3c7'];
                item.folderColor = colors[index % colors.length];
            }
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-item';
            folderDiv.style.backgroundColor = item.folderColor;
            folderDiv.draggable = true;
            folderDiv.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({from: 'global', index}));
                folderDiv.classList.add('dragging');
            };
            folderDiv.ondragover = (e) => {
                e.preventDefault();
                folderDiv.classList.add('drag-over');
            };
            folderDiv.ondragleave = (e) => {
                folderDiv.classList.remove('drag-over');
            };
            folderDiv.ondrop = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Предотвращаем всплытие
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceLayer = findLayerByPath(dragData.path);
                
                if (!sourceLayer) return;
                
                // Проверяем верхнюю/нижнюю половину папки
                const rect = folderDiv.getBoundingClientRect();
                const isTopHalf = (e.clientY - rect.top) < rect.height/2;
                
                if (isTopHalf) {
                    // Вставляем до папки
                    const idx = layers.indexOf(item);
                    deleteLayer(dragData.path);
                    layers.splice(idx, 0, sourceLayer);
                } else {
                    // Вставляем в папку
                    deleteLayer(dragData.path);
                    item.layers = item.layers || [];
                    item.layers.unshift(sourceLayer);
                }
                
                updateLayerList();
                redrawAllLayers();
            };
            // Кнопка сворачивания/разворачивания
            const toggleBtn = document.createElement('span');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.innerText = item.collapsed ? '► ' : '▼ ';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                item.collapsed = !item.collapsed;
                updateLayerList();
            };
            folderDiv.appendChild(toggleBtn);
            // Название папки (переименование по dblclick)
            const nameSpan = document.createElement('span');
            nameSpan.innerText = item.name;
            nameSpan.ondblclick = () => {
                const newName = prompt("Введите новое имя для папки:", item.name);
                if(newName) {
                    item.name = newName;
                    updateLayerList();
                }
            };
            folderDiv.appendChild(nameSpan);
            // Новая кнопка удаления в правом углу (используем спрайт)
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.style.float = 'right';
            delBtn.innerHTML = '×'; // Используем символ Unicode вместо спрайта
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteLayer(index);
            };
            folderDiv.appendChild(delBtn);
            layerList.appendChild(folderDiv);
            if (!item.collapsed) {
                const addContainer = document.createElement('div');
                addContainer.className = 'folder-children';
                // Добавляем обработчики для поддержки drop в "пустую" область папки
                addContainer.ondragover = (e) => {
                    e.preventDefault();
                    setDropIndicator(addContainer, true);
                };
                addContainer.ondragleave = () => {
                    setDropIndicator(addContainer, false);
                };
                addContainer.ondrop = (e) => {
                    e.preventDefault();
                    setDropIndicator(addContainer, false);
                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const sourceLayer = findLayerByPath(dragData.path);
                    // Удаляем слой из исходного места
                    deleteLayer(dragData.path);
                    item.layers = item.layers || [];
                    // Добавляем как последний вложенный элемент
                    item.layers.push(sourceLayer);
                    updateLayerList();
                    redrawAllLayers();
                };
                // Рекурсивно отображаем вложенные элементы:
                if(item.layers && item.layers.length > 0) {
                    item.layers.forEach((child, childIndex) => {
                        let childDiv = document.createElement('div');
                        childDiv.draggable = true;
                        if(child.isFolder) {
                            childDiv.className = 'folder-item';
                        } else {
                            childDiv.className = 'layer-item';
                            childDiv.style.backgroundColor = '#555';
                        }
                        childDiv.style.marginLeft = '20px';
                        childDiv.innerText = child.name;
                        // Обработчики drag для вложенных элементов:
                        childDiv.ondragstart = (e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', JSON.stringify({from: 'folder', folder: item, index: childIndex}));
                            childDiv.classList.add('dragging');
                        };
                        childDiv.ondragover = (e) => {
                            e.preventDefault();
                            childDiv.classList.add('drag-over');
                        };
                        childDiv.ondragleave = (e) => {
                            childDiv.classList.remove('drag-over');
                        };
                        childDiv.ondrop = (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            childDiv.classList.remove('drag-over');
                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if(data.from === 'folder') {
                                const sourceFolder = data.folder;
                                const movingItem = sourceFolder.layers.splice(data.index, 1)[0];
                                // если перетаскиваем на папку, добавить как вложенный
                                if(child.isFolder){
                                    child.layers = child.layers || [];
                                    child.layers.unshift(movingItem);
                                } else {
                                    // если перетаскиваем поверх слоя, меняем порядок внутри текущей папки
                                    item.layers.splice(childIndex, 0, movingItem);
                                }
                            }
                            updateLayerList();
                        };
                        // Переименование по dblclick
                        childDiv.ondblclick = () => {
                            const newName = prompt("Введите новое имя:", child.name);
                            if(newName){
                                child.name = newName;
                                updateLayerList();
                            }
                        };
                        // Кнопка удаления для вложенного элемента
                        const childDelBtn = document.createElement('button');
                        childDelBtn.className = 'delete-btn';
                        childDelBtn.innerHTML = '×'; // Используем символ Unicode вместо спрайта
                        childDelBtn.onclick = (e) => {
                            e.stopPropagation();
                            item.layers.splice(childIndex, 1);
                            updateLayerList();
                        };
                        childDiv.appendChild(childDelBtn);
                        addContainer.appendChild(childDiv);
                    });
                }
                layerList.appendChild(addContainer);
            }
        } else {
            // Обычный слой
            const layerDiv = document.createElement('div');
            layerDiv.className = 'layer-item';
            layerDiv.draggable = true;
            layerDiv.innerText = item.name;
            layerDiv.onclick = () => selectLayer([index]);
            layerDiv.ondblclick = () => {
                const newName = prompt("Введите новое имя для слоя:", item.name);
                if(newName) {
                    item.name = newName;
                    updateLayerList();
                    redrawAllLayers();
                }
            };
            layerDiv.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({from: 'global', index}));
                layerDiv.classList.add('dragging');
            };
            layerDiv.ondragover = (e) => {
                e.preventDefault();
                layerDiv.classList.add('drag-over');
            };
            layerDiv.ondragleave = () => {
                layerDiv.classList.remove('drag-over');
            };
            layerDiv.ondrop = (e) => {
                e.preventDefault();
                layerDiv.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if(data.from === 'global') {
                    const movingItem = layers.splice(data.index, 1)[0];
                    layers.splice(index, 0, movingItem);
                }
                updateLayerList();
                redrawAllLayers();
            };
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×'; // Используем символ Unicode вместо спрайта
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteLayer(index);
            };
            layerDiv.appendChild(delBtn);
            layerList.appendChild(layerDiv);
        }
    });
}

function deleteLayer(index, parentFolder) {
    if (parentFolder) {
        parentFolder.layers.splice(index, 1);
    } else {
        layers.splice(index, 1);
    }
    updateLayerList();
    redrawAllLayers();
}

// Обновляем функцию selectNestedLayer
function selectNestedLayer(folder, layer) {
    // Находим индекс слоя в общем массиве
    const globalIndex = layers.indexOf(folder);
    // Устанавливаем текущий слой
    if (!layer.isFolder) {
        currentLayerIndex = globalIndex;
        selectedNestedLayer = layer;
    }
    updateLayerList();
}

// Добавляем функцию для поиска слоя по пути
function findLayerByPath(path) {
    let current = layers;
    let layer = null;
    
    for (let i = 0; i < path.length; i++) {
        const index = path[i];
        if (i === path.length - 1) {
            layer = current[index];
        } else {
            current = current[index].layers;
        }
    }
    return layer;
}

// Обновляем функцию selectNestedLayer
function selectNestedLayer(folder, layer, path) {
    if (!layer.isFolder) {
        selectedNestedLayer = layer;
        currentLayerIndex = path;
    }
    updateLayerList();
}

// Обновляем функцию redrawAllLayers для поддержки вложенных слоев
function redrawAllLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    function drawLayer(layer) {
        if (!layer.visible) return;
        
        if (layer.isFolder) {
            layer.layers.forEach(drawLayer);
        } else {
            ctx.drawImage(layer.canvas, 0, 0);
            layer.selections.forEach(sel => drawSavedSelection(sel));
        }
    }
    
    // Рисуем все слои
    layers.forEach(drawLayer);
}

// Обновляем функцию updateLayerList
function updateLayerList() {
    const layerList = document.getElementById('layerList');
    layerList.innerHTML = '';
    
    function createLayerElement(item, path) {
        const div = document.createElement('div');
        div.draggable = true;
        
        if (item.isFolder) {
            div.className = 'folder-item';
            if (!item.folderColor) {
                const colors = ['#7f8c8d', '#95a5a6', '#bdc3c7'];
                item.folderColor = colors[path[0] % colors.length];
            }
            div.style.backgroundColor = item.folderColor;
            
            // Кнопка сворачивания
            const toggleBtn = document.createElement('span');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.innerText = item.collapsed ? '► ' : '▼ ';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                item.collapsed = !item.collapsed;
                updateLayerList();
            };
            div.appendChild(toggleBtn);
            
            // Имя папки
            const nameSpan = document.createElement('span');
            nameSpan.innerText = item.name;
            div.appendChild(nameSpan);
            
            // Кнопка удаления
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteLayer(path);
                updateLayerList();
            };
            div.appendChild(delBtn);
            
            // Контейнер для вложенных элементов
            if (!item.collapsed) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                childrenContainer.style.marginLeft = '20px';
                
                item.layers.forEach((child, index) => {
                    const childPath = [...path, 'layers', index];
                    const childElement = createLayerElement(child, childPath);
                    childrenContainer.appendChild(childElement);
                });
                
                div.appendChild(childrenContainer);
            }
        } else {
            div.className = 'layer-item';
            div.innerText = item.name;
            
            // Выделение текущего слоя
            if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
                div.classList.add('selected');
            }
            
            // Обработчик клика для выбора слоя
            div.onclick = () => {
                currentLayerIndex = path;
                updateLayerList();
                redrawAllLayers();
            };
            
            // Кнопка удаления
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteLayer(path);
                updateLayerList();
            };
            div.appendChild(delBtn);
        }
        
        // Обработчики перетаскивания
        div.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ path }));
            div.classList.add('dragging');
        };
        
        div.ondragover = (e) => {
            e.preventDefault();
            div.classList.add('drag-over');
        };
        
        div.ondragleave = () => {
            div.classList.remove('drag-over');
        };
        
        div.ondrop = (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const sourceLayer = findLayerByPath(dragData.path);
            
            // Удаляем слой из исходного места
            deleteLayer(dragData.path);
            
            // Добавляем слой в новое место
            if (item.isFolder) {
                item.layers = item.layers || [];
                item.layers.unshift(sourceLayer);
            } else {
                const parentPath = path.slice(0, -1);
                const parent = findLayerByPath(parentPath);
                const index = path[path.length - 1];
                if (Array.isArray(parent)) {
                    parent.splice(index, 0, sourceLayer);
                } else if (parent.layers) {
                    parent.layers.splice(index, 0, sourceLayer);
                }
            }
            
            updateLayerList();
            redrawAllLayers();
        };
        
        return div;
    }
    
    // Создаем элементы для всех слоев
    layers.forEach((item, index) => {
        layerList.appendChild(createLayerElement(item, [index]));
    });
}

// Обновляем функцию deleteLayer
function deleteLayer(path) {
    let current = layers;
    let parent = null;
    let index = null;
    
    // Находим родительский контейнер и индекс для удаления
    for (let i = 0; i < path.length; i++) {
        if (path[i] === 'layers') {
            if (i > 0 && current[path[i-1]]) {
                parent = current;
                current = current[path[i-1]].layers;
            }
            continue;
        }

        index = path[i];

        if (i === path.length - 1) {
            break;
        }

        current = current[path[i]];
    }
    
    if (parent && parent.layers) {
        parent.layers.splice(index, 1);
    } else {
        layers.splice(index, 1);
    }
    
    // Если удалили текущий слой, сбрасываем выбор
    if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
        currentLayerIndex = [0];
        selectedNestedLayer = layers[0];
    }
    redrawAllLayers();
    saveProgressToCache(); // Добавлено: обновление сохранения после удаления слоя
}

function moveLayer(fromIndex, toIndex) {
    const [movedLayer] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, movedLayer);
    updateLayerList();
    redrawAllLayers();
}

function selectLayer(path) {
    currentLayerIndex = path;
    updateLayerList();
    redrawAllLayers();
}

function redrawAllLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    function drawLayerContent(items) {
        // Проходим по массиву в обратном порядке для правильного наложения
        for (let i = items.length - 1; i >= 0; i--) {
            const layer = items[i];
            if (!layer.visible) continue;
            
            if (layer.isFolder) {
                // Если это папка - рисуем только её содержимое
                if (layer.layers && layer.layers.length > 0) {
                    drawLayerContent(layer.layers);
                }
            } else {
                // Если это слой - рисуем его содержимое
                ctx.drawImage(layer.canvas, 0, 0);
                if (layer.selections) {
                    layer.selections.forEach(sel => drawSavedSelection(sel));
                }
            }
        }
    }
    
    drawLayerContent(layers);
}

document.getElementById('addLayerButton').addEventListener('click', () => {
    createLayer();
});

document.getElementById('addFolderButton').addEventListener('click', () => {
    createFolder();
});


// Добавляем вспомогательную функцию для установки индикатора места вставки
function setDropIndicator(target, show) {
    if (show) {
        target.style.borderTop = "2px solid #f1c40f";
    } else {
        target.style.borderTop = "";
    }
}

// Обновлённая функция создания элемента слоя (вложенная или обычная)
function createLayerElement(item, path) {
    const div = document.createElement('div');
    div.draggable = true;
    
    if (item.isFolder) {
        div.className = 'folder-item';
        if (!item.folderColor) {
            const colors = ['#7f8c8d', '#95a5a6', '#bdc3c7'];
            item.folderColor = colors[path[0] % colors.length];
        }
        div.style.backgroundColor = item.folderColor;
        
        /* ...код кнопки сворачивания, переименования и удаления... */
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'toggle-btn';
        toggleBtn.innerText = item.collapsed ? '► ' : '▼ ';
        toggleBtn.onclick = (e) => { e.stopPropagation(); item.collapsed = !item.collapsed; updateLayerList(); };
        div.appendChild(toggleBtn);

        const nameSpan = document.createElement('span');
        nameSpan.innerText = item.name;
        nameSpan.ondblclick = (e) => {
            e.stopPropagation();
            const newName = prompt("Введите новое имя для папки:", item.name);
            if (newName && newName.trim()) {
                item.name = newName.trim();
                updateLayerList();
            }
        };
        div.appendChild(nameSpan);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteLayer(path); updateLayerList(); };
        div.appendChild(delBtn);
        
        // Обработчики перетаскивания для папки
        div.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ path }));
            div.classList.add('dragging');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            // Показываем индикатор вставки в верхней части элемента, если курсор в верхней половине
            const rect = div.getBoundingClientRect();
            setDropIndicator(div, (e.clientY - rect.top) < rect.height/2);
        };
        div.ondragleave = () => {
            setDropIndicator(div, false);
        };
        div.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); // Предотвращаем всплытие
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const sourceLayer = findLayerByPath(dragData.path);
            
            if (!sourceLayer) return;
            
            // Проверяем верхнюю/нижнюю половину папки
            const rect = div.getBoundingClientRect();
            const isTopHalf = (e.clientY - rect.top) < rect.height/2;
            
            if (isTopHalf) {
                // Вставляем до папки
                const idx = layers.indexOf(item);
                deleteLayer(dragData.path);
                layers.splice(idx, 0, sourceLayer);
            } else {
                // Вставляем в папку
                deleteLayer(dragData.path);
                item.layers = item.layers || [];
                item.layers.unshift(sourceLayer);
            }
            
            updateLayerList();
            redrawAllLayers();
        };
        
        // Если не свернута, создаём контейнер вложенных элементов
        if (!item.collapsed) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            childrenContainer.style.marginLeft = '20px';
            // Добавляем обработчики для поддержки drop в "пустую" область папки
            childrenContainer.ondragover = (e) => {
                e.preventDefault();
                setDropIndicator(childrenContainer, true);
            };
            childrenContainer.ondragleave = () => {
                setDropIndicator(childrenContainer, false);
            };
            childrenContainer.ondrop = (e) => {
                e.preventDefault();
                setDropIndicator(childrenContainer, false);
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceLayer = findLayerByPath(dragData.path);
                // Удаляем слой из исходного места
                deleteLayer(dragData.path);
                item.layers = item.layers || [];
                // Добавляем как последний вложенный элемент
                item.layers.push(sourceLayer);
                updateLayerList();
                redrawAllLayers();
            };
            item.layers.forEach((child, idx) => {
                const childPath = [...path, 'layers', idx];
                childrenContainer.appendChild(createLayerElement(child, childPath));
            });
            div.appendChild(childrenContainer);
        }
    } else { // Обычный слой
        div.className = 'layer-item';
        div.innerText = item.name;
        if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
            div.classList.add('selected');
        }
        div.onclick = () => { selectLayer(path); selectedNestedLayer = item; updateLayerList(); };
        div.ondblclick = () => {
            const newName = prompt("Введите новое имя для слоя:", item.name);
            if(newName && newName.trim()){
                item.name = newName.trim();
                updateLayerList();
                redrawAllLayers();
            }
        };
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteLayer(path); updateLayerList(); };
        div.appendChild(delBtn);
        
        div.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ path }));
            div.classList.add('dragging');
        };
        div.ondragover = (e) => {
            e.preventDefault();
            setDropIndicator(div, true);
        };
        div.ondragleave = () => {
            setDropIndicator(div, false);
        };
        div.ondrop = (e) => {
            e.preventDefault();
            setDropIndicator(div, false);
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const sourceLayer = findLayerByPath(dragData.path);
            deleteLayer(dragData.path);
            // Вставляем перед выбранным слоем
            const parentPath = path.slice(0, -1);
            const parent = parentPath.length ? findLayerByPath(parentPath) : layers;
            const index = path[path.length - 1];
            if (Array.isArray(parent)) {
                parent.splice(index, 0, sourceLayer);
            } else {
                parent.layers.splice(index, 0, sourceLayer);
            }
            updateLayerList();
            redrawAllLayers();
        };
    }
    return div;
}

// Переписываем updateLayerList для работы через createLayerElement
function updateLayerList() {
    const layerList = document.getElementById('layerList');
    layerList.innerHTML = '';
    layers.forEach((item, idx) => {
        layerList.appendChild(createLayerElement(item, [idx]));
    });
}

// Обновлённая функция deleteLayer, получающая путь как массив
function deleteLayer(path) {
    let arrayRef = layers;
    let lastIndex;
    for (let i = 0; i < path.length; i++) {
        if (path[i] === 'layers') {
            continue;
        }
        lastIndex = path[i];
        if (i + 1 < path.length && path[i + 1] === 'layers') {
            arrayRef = arrayRef[lastIndex].layers;
            i++; // пропускаем 'layers'
        }
    }
    arrayRef.splice(lastIndex, 1);

    // Если удалён текущий слой, сбрасываем выбор
    if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
        currentLayerIndex = [0];
        selectedNestedLayer = layers[0];
    }
    redrawAllLayers();
    saveProgressToCache(); // Добавлено: обновление сохранения после удаления слоя
}

/* ...existing code... */

// Обновляем обработчик ondrop для folder-item:
folderDiv.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Предотвращаем всплытие
    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
    const sourceLayer = findLayerByPath(dragData.path);
    
    if (!sourceLayer) return;
    
    // Проверяем верхнюю/нижнюю половину папки
    const rect = folderDiv.getBoundingClientRect();
    const isTopHalf = (e.clientY - rect.top) < rect.height/2;
    
    if (isTopHalf) {
        // Вставляем до папки
        const idx = layers.indexOf(item);
        deleteLayer(dragData.path);
        layers.splice(idx, 0, sourceLayer);
    } else {
        // Вставляем в папку
        deleteLayer(dragData.path);
        item.layers = item.layers || [];
        item.layers.unshift(sourceLayer);
    }
    
    updateLayerList();
    redrawAllLayers();
};

// Исправляем функцию findLayerByPath
function findLayerByPath(path) {
    let current = layers;
    
    for (let i = 0; i < path.length; i++) {
        if (!current) return null;
        
        if (path[i] === 'layers') {
            if (i > 0 && current[path[i-1]]) {
                current = current[path[i-1]].layers;
            }
            continue;
        }
        
        if (current[path[i]] === undefined) return null;
        
        if (i === path.length - 1) {
            return current[path[i]];
        }
        
        current = current[path[i]];
    }
    return null;
}

// Изменяем функцию deleteLayer
function deleteLayer(path) {
    let current = layers;
    let parent = null;
    let index = null;

    // Находим родительский контейнер и индекс для удаления
    for (let i = 0; i < path.length; i++) {
        if (path[i] === 'layers') {
            if (i > 0 && current[path[i-1]]) {
                parent = current;
                current = current[path[i-1]].layers;
            }
            continue;
        }

        index = path[i];

        if (i === path.length - 1) {
            break;
        }

        current = current[path[i]];
    }

    if (parent && parent.layers) {
        parent.layers.splice(index, 1);
    } else {
        layers.splice(index, 1);
    }

    // Если удалили текущий слой, сбрасываем выбор
    if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
        currentLayerIndex = [0];
        selectedNestedLayer = layers[0];
    }
    redrawAllLayers();
    saveProgressToCache(); // Добавлено: обновление сохранения после удаления слоя
}

/* ...existing code... */

// Исправленная функция deleteLayer:
function deleteLayer(path) {
    let arrayRef = layers;
    let lastIndex;
    for (let i = 0; i < path.length; i++) {
        if (path[i] === 'layers') {
            continue;
        }
        lastIndex = path[i];
        if (i + 1 < path.length && path[i + 1] === 'layers') {
            arrayRef = arrayRef[lastIndex].layers;
            i++; // пропускаем 'layers'
        }
    }
    arrayRef.splice(lastIndex, 1);

    // Если удалён текущий слой, сбрасываем выбор
    if (JSON.stringify(currentLayerIndex) === JSON.stringify(path)) {
        currentLayerIndex = [0];
        selectedNestedLayer = layers[0];
    }
    redrawAllLayers();
    saveProgressToCache(); // Добавлено: обновление сохранения после удаления слоя
}

/* ...existing code... */

// Обновляем функцию redrawAllLayers, чтобы папки не рисовались на холсте 
function redrawAllLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    function drawLayerContent(items) {
        // Проходим по массиву в обратном порядке для правильного наложения
        for (let i = items.length - 1; i >= 0; i--) {
            const layer = items[i];
            if (!layer.visible) continue;
            
            if (layer.isFolder) {
                // Если это папка - рисуем только её содержимое
                if (layer.layers && layer.layers.length > 0) {
                    drawLayerContent(layer.layers);
                }
            } else {
                // Если это слой - рисуем его содержимое
                ctx.drawImage(layer.canvas, 0, 0);
                if (layer.selections) {
                    layer.selections.forEach(sel => drawSavedSelection(sel));
                }
            }
        }
    }
    
    drawLayerContent(layers);
}

// Функция отрисовки выделения
function drawSelectionOverlay() {
    if (!selectionStart || !selectionEnd) return;
    
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    
    const startX = Math.min(selectionStart.x, selectionEnd.x) * cellSize;
    const startY = Math.min(selectionStart.y, selectionEnd.y) * cellSize;
    const width = (Math.abs(selectionEnd.x - selectionStart.x) + 1) * cellSize;
    const height = (Math.abs(selectionEnd.y - selectionStart.y) + 1) * cellSize;
    
    overlayCtx.save();
    overlayCtx.strokeStyle = '#0066ff';
    overlayCtx.lineWidth = 2;
    overlayCtx.setLineDash([5, 3]);
    overlayCtx.strokeRect(startX, startY, width, height);
    
    // Отображаем размеры выделения
    const cellsWidth = Math.abs(selectionEnd.x - selectionStart.x) + 1;
    const cellsHeight = Math.abs(selectionEnd.y - selectionStart.y) + 1;
    overlayCtx.font = '14px Arial';
    overlayCtx.fillStyle = '#0066ff';
    overlayCtx.fillText(`${cellsWidth} x ${cellsHeight}`, startX, startY - 5);
    
    overlayCtx.restore();
}

// ...existing code...

// Добавляем функцию saveSelection (заменяет закомментированные версии)
function saveSelection() {
    if (!selectedArea) return;
    const currentLayer = getActiveLayer();
    currentLayer.selections = currentLayer.selections || [];
    // Сохраняем выделенную область с учетом выбранного цвета
    currentLayer.selections.push({ 
        startX: selectedArea.startX * cellSize,
        startY: selectedArea.startY * cellSize,
        width: (selectedArea.endX - selectedArea.startX + 1) * cellSize,
        height: (selectedArea.endY - selectedArea.startY + 1) * cellSize,
        color: selectionColor
    });
    // Очистка выделения и перерисовка
    clearSelection();
    redrawAllLayers();
}

// Добавляем функцию для активации режима выделения
function activateSelectionMode() {
    instrument = 'selection';
    clearSelection();
    // Можно добавить вывод информации, что выделение активно
    document.getElementById('selectionInfo').innerText = "Режим выделения активирован";
}

/* Добавляем функцию для удаления выделения */
function deleteSelectionMode() {
    clearSelection();
    // Удаляем сохранённые выделения из активного слоя (если необходимо)
    const currentLayer = getActiveLayer();
    if (currentLayer && currentLayer.selections) {
        currentLayer.selections = [];
        redrawAllLayers();
    }
    document.getElementById('selectionInfo').innerText = "Выделение удалено";
}

/* Изменяем функцию сохранения выделения так, чтобы оно сохранялось по кнопке и работало со слоями */
function saveSelection() {
    if (!selectedArea) return;
    const currentLayer = getActiveLayer();
    currentLayer.selections = currentLayer.selections || [];
    currentLayer.selections.push({ 
        startX: selectedArea.startX * cellSize,
        startY: selectedArea.startY * cellSize,
        width: (selectedArea.endX - selectedArea.startX + 1) * cellSize,
        height: (selectedArea.endY - selectedArea.startY + 1) * cellSize,
        color: selectionColor
    });
    clearSelection();
    selectedArea = null;
    redrawAllLayers();
    document.getElementById('selectionInfo').innerText = "Выделение сохранено";
}

/* ...existing code... */

// В обработчике mouseup для инструмента выделения оставляем формирование выделенной области
canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (instrument === 'selection') {
        // Если выделение ещё не создано, сохраняем его
        if (selectionStart && selectionEnd && !selectedArea) {
            const currentLayer = getActiveLayer();
            if (!currentLayer.isFolder) {
                selectedArea = {
                    layer: currentLayer,
                    startX: Math.min(selectionStart.x, selectionEnd.x),
                    startY: Math.min(selectionStart.y, selectionEnd.y),
                    endX: Math.max(selectionStart.x, selectionEnd.x),
                    endY: Math.max(selectionStart.y, selectionEnd.y)
                };
            }
        }
    } else if (instrument === 'rectangle' && isDrawingRectangle) {
        isDrawingRectangle = false;
        rectangleEnd = {
            x: Math.floor((e.clientX - rect.left) / cellSize),
            y: Math.floor((e.clientY - rect.top) / cellSize)
        };
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        let startX = Math.min(rectangleStart.x, rectangleEnd.x) * cellSize;
        let startY = Math.min(rectangleStart.y, rectangleEnd.y) * cellSize;
        let width = (Math.abs(rectangleEnd.x - rectangleStart.x) + 1) * cellSize;
        let height = (Math.abs(rectangleEnd.y - rectangleStart.y) + 1) * cellSize;
        const currentLayer = getActiveLayer();
        currentLayer.ctx.save();
        currentLayer.ctx.fillStyle = color;
        currentLayer.ctx.fillRect(startX, startY, width, height);
        currentLayer.ctx.restore();
        currentLayer.rectangles.push({ x: startX, y: startY, width, height, color });
        redrawAllLayers();
        rectangleStart = null;
        rectangleEnd = null;
        saveProgressToCache(); // Сохраняем прогресс после рисования прямоугольника
    } else if (instrument === 'line' && lineDrawing) {
        lineDrawing = false;
        lineEnd = getGridIntersection(e);
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
        const currentLayer = getActiveLayer();
        currentLayer.ctx.save();
        currentLayer.ctx.strokeStyle = color;
        currentLayer.ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
        currentLayer.ctx.beginPath();
        currentLayer.ctx.moveTo(lineStart.x, lineStart.y);
        currentLayer.ctx.lineTo(lineEnd.x, lineEnd.y);
        currentLayer.ctx.stroke();
        currentLayer.ctx.restore();
        redrawAllLayers();
        saveProgressToCache(); // Сохраняем прогресс после отрисовки линии
    } else {
        drawing = false;
        // Если завершилось рисование кистью, сохраняем прогресс
        if (instrument === 'brush' || instrument === 'eraser') {
            saveProgressToCache();
        }
    }
});

// Добавляем функцию для отрисовки сохранённого выделения
function drawSavedSelection(selection) {
    savedOverlayCtx.save();
    savedOverlayCtx.strokeStyle = selection.color;
    savedOverlayCtx.lineWidth = 2;
    savedOverlayCtx.setLineDash([5, 3]);
    savedOverlayCtx.strokeRect(
        selection.startX,
        selection.startY,
        selection.width,
        selection.height
    );
    
    // Обновляем стиль текста
    savedOverlayCtx.font = 'bold 16px Helvetica, Arial, sans-serif';
    savedOverlayCtx.fillStyle = selection.color;
    const text = `${selection.name} (${selection.dimensions})`;
    
    // Добавляем тень для лучшей читаемости
    savedOverlayCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    savedOverlayCtx.shadowBlur = 4;
    
    // Позиционируем текст
    const textY = selection.startY > 25 ? 
        selection.startY - 8 : 
        selection.startY + selection.height + 20;
    
    savedOverlayCtx.fillText(text, selection.startX, textY);
    
    savedOverlayCtx.restore();
}

// Обновляем функцию saveSelection
function saveSelection() {
    if (!selectedArea) return;
    
    const currentLayer = getActiveLayer();
    if (!currentLayer || currentLayer.isFolder) return;
    
    // Запрашиваем название региона
    const regionName = prompt("Введите название региона:", "");
    if (!regionName) return; // Если пользователь нажал "Отмена" или не ввел название
    
    currentLayer.selections = currentLayer.selections || [];
    
    // Вычисляем размеры в клетках
    const cellsWidth = selectedArea.endX - selectedArea.startX + 1;
    const cellsHeight = selectedArea.endY - selectedArea.startY + 1;
    
    // Создаём сплошное выделение с дополнительной информацией
    const selection = {
        startX: selectedArea.startX * cellSize,
        startY: selectedArea.startY * cellSize,
        width: (selectedArea.endX - selectedArea.startX + 1) * cellSize,
        height: (selectedArea.endY - selectedArea.startY + 1) * cellSize,
        color: document.getElementById('selectionColorPicker').value,
        name: regionName,
        dimensions: `${cellsWidth} x ${cellsHeight}`,
        cellsWidth: cellsWidth,
        cellsHeight: cellsHeight
    };
    
    // Добавляем в слой
    currentLayer.selections.push(selection);
    
    // Очищаем текущее выделение
    clearSelection();
    selectedArea = null;
    isSelectingActive = false;
    
    // Перерисовываем всё
    redrawAllLayers();
    
    document.getElementById('selectionInfo').innerText = 
        `Сохранено: ${regionName} (${cellsWidth} x ${cellsHeight})`;
    saveProgressToCache(); // Добавлено: сохраняем выделение в localStorage
}

// Обновляем функцию redrawAllLayers
function redrawAllLayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    savedOverlayCtx.clearRect(0, 0, savedOverlay.width, savedOverlay.height);
    
    function drawLayerContent(items) {
        for (let i = items.length - 1; i >= 0; i--) {
            const layer = items[i];
            if (!layer.visible) return;
            
            if (layer.isFolder) {
                if (layer.layers && layer.layers.length > 0) {
                    drawLayerContent(layer.layers);
                }
            } else {
                ctx.drawImage(layer.canvas, 0, 0);
                // Отрисовываем сохранённые выделения для слоя
                if (layer.selections && layer.selections.length > 0) {
                    layer.selections.forEach(selection => drawSavedSelection(selection));
                }
            }
        }
    }
    
    drawLayerContent(layers);
}

// Добавляем функции для работы с кешем
function saveProgressToCache() {
    // Сохраняем содержимое canvas
    const mainCanvasData = canvas.toDataURL('image/png');
    localStorage.setItem('gridPainterProgress', mainCanvasData);

    // Сохраняем структуру слоёв
    const layersData = layers.map(layer => {
        if (layer.isFolder) {
            return {
                name: layer.name,
                isFolder: true,
                visible: layer.visible,
                collapsed: layer.collapsed,
                folderColor: layer.folderColor,
                layers: layer.layers.map(subLayer => ({
                    name: subLayer.name,
                    visible: subLayer.visible,
                    canvasData: subLayer.canvas?.toDataURL('image/png'),
                    selections: subLayer.selections || []
                }))
            };
        } else {
            return {
                name: layer.name,
                visible: layer.visible,
                canvasData: layer.canvas.toDataURL('image/png'),
                selections: layer.selections || []
            };
        }
    });
    localStorage.setItem('gridPainterLayers', JSON.stringify(layersData));

    // Сохраняем остальные изменяемые параметры
    const settings = {
        cellSize,
        gridWidth,
        gridHeight,
        gridThickness,
        backgroundColor,
        cellColor,
        brushSize,
        selectionColor,
        theme: document.getElementById('themeSelector').value
    };
    localStorage.setItem('gridPainterSettings', JSON.stringify(settings));
}

function loadProgressFromCache() {
    // Загружаем сохранённые параметры
    const settingsData = localStorage.getItem('gridPainterSettings');
    if (settingsData) {
        const settings = JSON.parse(settingsData);
        cellSize = settings.cellSize;
        gridWidth = settings.gridWidth;
        gridHeight = settings.gridHeight;
        gridThickness = settings.gridThickness;
        backgroundColor = settings.backgroundColor;
        cellColor = settings.cellColor;
        brushSize = settings.brushSize;
        selectionColor = settings.selectionColor;
        // Обновляем значения элементов управления
        document.getElementById('cellSize').value = cellSize;
        document.getElementById('gridWidth').value = gridWidth;
        document.getElementById('gridHeight').value = gridHeight;
        document.getElementById('gridThickness').value = gridThickness;
        document.getElementById('backgroundColorPicker').value = backgroundColor;
        document.getElementById('cellColorPicker').value = cellColor;
        document.getElementById('brushSize').value = brushSize;
        document.getElementById('selectionColorPicker').value = selectionColor;
        // Устанавливаем сохранённую тему, если она есть
        if (settings.theme) {
            document.getElementById('themeSelector').value = settings.theme;
        }
        // Применяем сохранённое оформление
        updateGridLayer();
        changeTheme();
    }
    
    // Загружаем структуру слоёв
    const layersData = localStorage.getItem('gridPainterLayers');
    if (layersData) {
        const parsedLayers = JSON.parse(layersData);
        layers = []; // Очищаем текущие слои

        function createLayerFromData(layerData) {
            if (layerData.isFolder) {
                const folder = {
                    name: layerData.name,
                    isFolder: true,
                    visible: layerData.visible,
                    collapsed: layerData.collapsed,
                    folderColor: layerData.folderColor,
                    layers: layerData.layers.map(subLayerData => {
                        const subLayer = createLayerFromData(subLayerData);
                        subLayer.parent = folder;
                        return subLayer;
                    })
                };
                return folder;
            } else {
                const layer = {
                    name: layerData.name,
                    canvas: document.createElement('canvas'),
                    visible: layerData.visible,
                    selections: layerData.selections || [],
                    rectangles: []
                };
                layer.canvas.width = canvas.width;
                layer.canvas.height = canvas.height;
                layer.ctx = layer.canvas.getContext('2d');

                if (layerData.canvasData) {
                    const img = new Image();
                    img.onload = function() {
                        layer.ctx.drawImage(img, 0, 0);
                        redrawAllLayers();
                    };
                    img.src = layerData.canvasData;
                }
                return layer;
            }
        }
        // Воссоздаём структуру слоёв
        layers = parsedLayers.map(layerData => createLayerFromData(layerData));
        // Если слоёв нет, создаём базовый слой
        if (layers.length === 0) {
            createLayer("Базовый слой");
        }
        updateLayerList();
        redrawAllLayers();
    }
}

// ...existing code...

// Функция экспорта проекта
function exportProject() {
    const projectData = {
        progress: localStorage.getItem('gridPainterProgress'),
        layers: localStorage.getItem('gridPainterLayers'),
        settings: localStorage.getItem('gridPainterSettings')
    };
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project.json';
    link.click();
    URL.revokeObjectURL(url);
}

// Функция импорта проекта
function importProject(files) {
    if (!files || !files[0]) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // Сохраняем данные в localStorage
            localStorage.setItem('gridPainterProgress', data.progress || '');
            localStorage.setItem('gridPainterLayers', data.layers || '');
            localStorage.setItem('gridPainterSettings', data.settings || '');
            // Обновляем состояние проекта
            loadProgressFromCache();
            redrawAllLayers();
            alert('Проект успешно импортирован.');
        } catch (err) {
            alert('Ошибка импорта проекта. Проверьте формат файла.');
        }
    };
    reader.readAsText(file);
}

// ...existing code...
