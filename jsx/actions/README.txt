Положите сюда файл действий Illustrator (.aia) с набором под именем: TimelineHelper
и действием: Trace

Как создать:
1) В Illustrator откройте Actions (Окно → Действия).
2) Создайте набор "TimelineHelper".
3) Запишите действие "Trace": выберите Raster/Placed объект, примените Image Trace с нужными настройками, остановите запись.
4) Через меню Actions экспортируйте набор в файл trace.aia и сохраните как jsx/actions/trace.aia.

Кнопка панели "Run Image Trace (AI)" сначала пытается выполнить трейсинг через API/меню.
Если не получается (Illustrator 2025 и новее), она попробует запустить действие Trace из набора TimelineHelper,
автоматически подгрузив jsx/actions/trace.aia при необходимости.

