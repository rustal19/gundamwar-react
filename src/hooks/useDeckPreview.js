import { useEffect, useMemo, useState } from "react";
import { getCardCode, getCardImageCandidates } from "../utils/cardImages";

const CARD_RATIO = 88 / 63;

function getCardIdentity(card) {
  return String(card?.cardId || getCardCode(card) || card?.name || Math.random());
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function resolveCardImage(card) {
  const candidates = getCardImageCandidates(card);
  for (const candidate of candidates) {
    const image = await loadImage(candidate);
    if (image) {
      return image;
    }
  }
  return null;
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  roundRectPath(ctx, x, y, width, height, radius);
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawCardTile(ctx, image, item, x, y, width, height) {
  const imageInset = 6;
  const imageWidth = width - imageInset * 2;
  const imageHeight = height - imageInset * 2;
  drawRoundedRect(ctx, x, y, width, height, 10, "#ffffff", "#d8dee8");

  if (image) {
    ctx.drawImage(image, x + imageInset, y + imageInset, imageWidth, imageHeight);
    return;
  }

  drawRoundedRect(
    ctx,
    x + imageInset,
    y + imageInset,
    imageWidth,
    imageHeight,
    8,
    "#eef2f6",
    "#d8dee8"
  );
  ctx.fillStyle = "#4d5c71";
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(getCardCode(item.card) || "NO IMAGE", x + width / 2, y + height / 2);
}

function drawEmptyTile(ctx, x, y, width, height) {
  drawRoundedRect(ctx, x, y, width, height, 10, "#ffffff", "#d8dee8");
  ctx.save();
  ctx.setLineDash([6, 6]);
  roundRectPath(ctx, x + 8, y + 8, width - 16, height - 16, 8);
  ctx.strokeStyle = "#d6dde7";
  ctx.stroke();
  ctx.restore();
}

function drawBoardHeading(ctx, title, count, limit, x, y, width) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#182132";
  ctx.font = "700 28px 'Segoe UI', sans-serif";
  ctx.fillText(title, x, y + 16);

  ctx.textAlign = "right";
  ctx.font = "700 24px 'Segoe UI', sans-serif";
  ctx.fillText(`${count} / ${limit}`, x + width, y + 16);
}

function drawCardsGrid(ctx, items, imageMap, x, y, columns, rows, tileWidth, tileHeight, gap) {
  const totalSlots = columns * rows;
  for (let index = 0; index < totalSlots; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileX = x + column * (tileWidth + gap);
    const tileY = y + row * (tileHeight + gap);
    const item = items[index];
    if (!item) {
      drawEmptyTile(ctx, tileX, tileY, tileWidth, tileHeight);
      continue;
    }
    const identity = getCardIdentity(item.card);
    drawCardTile(ctx, imageMap.get(identity), item, tileX, tileY, tileWidth, tileHeight);
  }
}

function expandItemsByCount(items, maxSlots) {
  const expanded = [];
  for (const item of items || []) {
    const repeatCount = Math.max(0, Number(item?.count || 0));
    for (let index = 0; index < repeatCount; index += 1) {
      if (expanded.length >= maxSlots) {
        return expanded;
      }
      expanded.push(item);
    }
  }
  return expanded;
}

function buildPreviewCanvas({ mainItems, sideItems, mainCount, sideCount, imageMap }) {
  const pagePadding = 28;
  const columns = 10;
  const mainRows = 5;
  const sideRows = 1;
  const tileGap = 8;
  const tileWidth = 95;
  const tileHeight = Math.round(tileWidth * CARD_RATIO);
  const gridWidth = columns * tileWidth + (columns - 1) * tileGap;
  const canvasWidth = pagePadding * 2 + gridWidth;
  const headerHeight = 34;
  const dividerGap = 18;
  const dividerLineGap = 16;
  const mainGridHeight = mainRows * tileHeight + (mainRows - 1) * tileGap;
  const sideGridHeight = sideRows * tileHeight;
  const expandedMainItems = expandItemsByCount(mainItems || [], columns * mainRows);
  const expandedSideItems = expandItemsByCount(sideItems || [], columns * sideRows);
  const canvasHeight =
    pagePadding * 2 +
    headerHeight +
    mainGridHeight +
    dividerGap +
    dividerLineGap +
    dividerGap +
    headerHeight +
    sideGridHeight;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#eef3f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBoardHeading(ctx, "メインデッキ", mainCount, 50, pagePadding, pagePadding, gridWidth);
  const mainGridY = pagePadding + headerHeight;
  drawCardsGrid(
    ctx,
    expandedMainItems,
    imageMap,
    pagePadding,
    mainGridY,
    columns,
    mainRows,
    tileWidth,
    tileHeight,
    tileGap
  );

  const dividerY = mainGridY + mainGridHeight + dividerGap;
  ctx.strokeStyle = "#cfd7e2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pagePadding, dividerY);
  ctx.lineTo(canvasWidth - pagePadding, dividerY);
  ctx.stroke();

  const sideTitleY = dividerY + dividerLineGap;
  drawBoardHeading(ctx, "サイドボード", sideCount, 10, pagePadding, sideTitleY, gridWidth);
  drawCardsGrid(
    ctx,
    expandedSideItems,
    imageMap,
    pagePadding,
    sideTitleY + headerHeight,
    columns,
    sideRows,
    tileWidth,
    tileHeight,
    tileGap
  );

  return canvas;
}

export function useDeckPreview({ open, mainItems, sideItems, mainCount, sideCount }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBlob, setPreviewBlob] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const previewItems = useMemo(
    () => [...(mainItems || []), ...(sideItems || [])],
    [mainItems, sideItems]
  );

  useEffect(() => {
    if (!open) {
      setPreviewUrl("");
      setPreviewBlob(null);
      setIsRendering(false);
      setErrorMessage("");
      return undefined;
    }

    let isCancelled = false;
    let objectUrl = "";

    const renderPreview = async () => {
      setIsRendering(true);
      setErrorMessage("");
      setPreviewBlob(null);
      setPreviewUrl("");

      try {
        const loadedEntries = await Promise.all(
          previewItems.map(async (item) => {
            const image = await resolveCardImage(item.card);
            return [getCardIdentity(item.card), image];
          })
        );

        if (isCancelled) return;

        const imageMap = new Map(loadedEntries);
        const canvas = buildPreviewCanvas({
          mainItems,
          sideItems,
          mainCount,
          sideCount,
          imageMap,
        });

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob || isCancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(objectUrl);
      } catch (error) {
        console.error("Failed to render deck preview.", error);
        if (!isCancelled) {
          setErrorMessage("プレビューの生成に失敗しました。");
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    renderPreview();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mainCount, mainItems, open, previewItems, sideCount, sideItems]);

  return {
    previewUrl,
    previewBlob,
    isRendering,
    errorMessage,
  };
}
