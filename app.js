/*
 * 凸透镜成像规律实验模拟器
 *
 * 结构说明：
 * - state：集中保存可调实验数据，便于后续接入练习模式或实验记录。
 * - getImageData：只负责光学计算与五种成像状态判断。
 * - renderStage：只负责将当前状态绘制到 SVG 光具座上。
 * - updateDashboard：只负责更新读数与文字反馈。
 *
 * 本版本采用薄凸透镜近轴公式：1/f = 1/u + 1/v。
 * 虚像用负像距表示，便于和实像的正像距区分。
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  objectDistance: 30,
  focalLength: 10,
  defaults: {
    objectDistance: 30,
    focalLength: 10,
  },
};

const stage = document.querySelector("#optics-stage");
const stageWrap = stage.closest(".stage-wrap");
const objectDistanceInput = document.querySelector("#object-distance");
const focalLengthInput = document.querySelector("#focal-length");
const objectDistanceNumber = document.querySelector("#object-distance-number");
const focalLengthNumber = document.querySelector("#focal-length-number");
const resetButton = document.querySelector("#reset-button");

const ui = {
  relationBadge: document.querySelector("#relation-badge"),
  statusU: document.querySelector("#status-u"),
  statusF: document.querySelector("#status-f"),
  statusV: document.querySelector("#status-v"),
  statusRelation: document.querySelector("#status-relation"),
  orientationTag: document.querySelector("#orientation-tag"),
  sizeTag: document.querySelector("#size-tag"),
  realityTag: document.querySelector("#reality-tag"),
  resultDetail: document.querySelector("#result-detail"),
};

/* SVG 舞台上的固定几何参数。数值使用 viewBox 坐标，不随 CSS 尺寸改变。 */
const geometry = {
  width: 1120,
  height: 600,
  lensX: 575,
  axisY: 270,
  railY: 463,
  leftEdge: 70,
  rightEdge: 1060,
  unitPx: 9,
  objectHeight: 116,
  maxVisibleImageDistance: 47,
};

/** 创建 SVG 元素并一次性写入属性。 */
function svgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

/** 便捷地添加 SVG 文字。 */
function svgText(text, x, y, attributes = {}) {
  const label = svgElement("text", {
    x,
    y,
    fill: "#36536e",
    "font-size": 15,
    "font-weight": 700,
    "text-anchor": "middle",
    ...attributes,
  });
  label.textContent = text;
  return label;
}

/** 把厘米保留最多 1 位小数，去掉无意义的 .0。 */
function formatCentimeters(value) {
  if (!Number.isFinite(value)) return "∞";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} cm`;
}

/**
 * 根据物距和焦距计算成像数据。
 * result.kind 可用于后续练习模式评分或实验记录。
 */
function getImageData(u, f) {
  if (u > 2 * f) {
    const v = (f * u) / (u - f);
    return {
      kind: "outside-2f",
      relation: "u > 2f",
      imageDistance: v,
      magnification: -v / u,
      orientation: "倒立",
      size: "缩小",
      reality: "实像",
      screenMessage: "光屏可承接清晰的像。",
    };
  }

  if (u === 2 * f) {
    return {
      kind: "at-2f",
      relation: "u = 2f",
      imageDistance: 2 * f,
      magnification: -1,
      orientation: "倒立",
      size: "等大",
      reality: "实像",
      screenMessage: "光屏位于凸透镜另一侧 2F 处时，可承接清晰的等大像。",
    };
  }

  if (u > f) {
    const v = (f * u) / (u - f);
    return {
      kind: "between-f-and-2f",
      relation: "f < u < 2f",
      imageDistance: v,
      magnification: -v / u,
      orientation: "倒立",
      size: "放大",
      reality: "实像",
      screenMessage: "光屏可承接清晰的放大实像；像距大于 2f。",
    };
  }

  if (u === f) {
    return {
      kind: "at-f",
      relation: "u = f",
      imageDistance: Infinity,
      magnification: null,
      orientation: "—",
      size: "—",
      reality: "不成像",
      screenMessage: "出射光线相互平行，光屏上无法得到清晰的像。",
    };
  }

  const v = (f * u) / (u - f);
  return {
    kind: "inside-f",
    relation: "u < f",
    imageDistance: v,
    magnification: -v / u,
    orientation: "正立",
    size: "放大",
    reality: "虚像",
    screenMessage: "虚像不能用光屏承接，需要透过凸透镜观察。",
  };
}

/** 更新右侧实时信息和控制器读数。 */
function updateDashboard(image) {
  objectDistanceInput.value = String(state.objectDistance);
  focalLengthInput.value = String(state.focalLength);
  objectDistanceNumber.value = String(state.objectDistance);
  focalLengthNumber.value = String(state.focalLength);
  ui.statusU.textContent = formatCentimeters(state.objectDistance);
  ui.statusF.textContent = formatCentimeters(state.focalLength);
  ui.statusV.textContent = image.imageDistance < 0
    ? `−${formatCentimeters(Math.abs(image.imageDistance))}`
    : formatCentimeters(image.imageDistance);
  ui.statusRelation.textContent = image.relation;
  ui.relationBadge.textContent = image.relation;
  ui.orientationTag.textContent = image.orientation;
  ui.sizeTag.textContent = image.size;
  ui.realityTag.textContent = image.reality;
  ui.resultDetail.textContent = image.screenMessage;
}

/** 绘制 SVG 的 <defs>：箭头、阴影、凸透镜渐变。 */
function addDefinitions(svg) {
  const defs = svgElement("defs");

  const lensGradient = svgElement("linearGradient", {
    id: "lens-gradient",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "0%",
  });
  [
    ["0%", "#caefff", "0.92"],
    ["48%", "#e9fbff", "0.76"],
    ["100%", "#8ed7fa", "0.94"],
  ].forEach(([offset, color, opacity]) => {
    lensGradient.append(svgElement("stop", { offset, "stop-color": color, "stop-opacity": opacity }));
  });

  const glow = svgElement("filter", { id: "glow", x: "-25%", y: "-25%", width: "150%", height: "150%" });
  glow.append(svgElement("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" }));
  const merge = svgElement("feMerge");
  merge.append(svgElement("feMergeNode", { in: "coloredBlur" }));
  merge.append(svgElement("feMergeNode", { in: "SourceGraphic" }));
  glow.append(merge);

  const arrow = svgElement("marker", {
    id: "small-arrow",
    markerWidth: "7",
    markerHeight: "7",
    refX: "6",
    refY: "3.5",
    orient: "auto",
    markerUnits: "strokeWidth",
  });
  arrow.append(svgElement("path", { d: "M0,0 L7,3.5 L0,7 z", fill: "#637991" }));

  defs.append(lensGradient, glow, arrow);
  svg.append(defs);
}

/** 绘制淡色背景、主光轴和光具座。 */
function drawBench(svg) {
  const { lensX, axisY, railY, leftEdge, rightEdge } = geometry;
  svg.append(svgElement("path", {
    d: `M ${leftEdge} ${axisY} H ${rightEdge}`,
    stroke: "#7a99b7",
    "stroke-width": 2,
    "stroke-dasharray": "10 8",
  }));
  svg.append(svgText("主光轴", rightEdge - 34, axisY - 12, { "font-size": 13, fill: "#67829d" }));

  const rail = svgElement("g");
  rail.append(svgElement("rect", {
    x: leftEdge,
    y: railY,
    width: rightEdge - leftEdge,
    height: 24,
    rx: 10,
    fill: "#6f8499",
  }));
  rail.append(svgElement("rect", {
    x: leftEdge + 12,
    y: railY + 5,
    width: rightEdge - leftEdge - 24,
    height: 6,
    rx: 3,
    fill: "#adc3d4",
  }));
  rail.append(svgElement("rect", {
    x: leftEdge + 12,
    y: railY + 15,
    width: rightEdge - leftEdge - 24,
    height: 4,
    rx: 2,
    fill: "#546b82",
  }));

  // 光具座刻度仅作为直观参照，具体读数以控制器中的厘米数为准。
  for (let x = leftEdge + 25; x < rightEdge - 15; x += 25) {
    rail.append(svgElement("line", {
      x1: x,
      y1: railY + 1,
      x2: x,
      y2: railY + (x % 50 === 0 ? 9 : 6),
      stroke: "#dce9f3",
      "stroke-width": 1,
      opacity: "0.65",
    }));
  }
  svg.append(rail);

  svg.append(svgElement("line", {
    x1: lensX,
    y1: railY - 2,
    x2: lensX,
    y2: railY + 33,
    stroke: "#516a80",
    "stroke-width": 3,
  }));
}

/** 绘制左右两侧的 F、2F 标记。 */
function drawFocalMarkers(svg, fPx) {
  const { lensX, axisY } = geometry;
  const markers = [
    { x: lensX - 2 * fPx, label: "2F", kind: "double" },
    { x: lensX - fPx, label: "F", kind: "focus" },
    { x: lensX + fPx, label: "F", kind: "focus" },
    { x: lensX + 2 * fPx, label: "2F", kind: "double" },
  ];

  markers.forEach((marker) => {
    svg.append(svgElement("line", {
      x1: marker.x,
      y1: axisY - 11,
      x2: marker.x,
      y2: axisY + 11,
      stroke: marker.kind === "focus" ? "#e77529" : "#8aa0b6",
      "stroke-width": marker.kind === "focus" ? 3 : 2,
    }));
    svg.append(svgElement("circle", {
      cx: marker.x,
      cy: axisY,
      r: marker.kind === "focus" ? 5 : 4,
      fill: marker.kind === "focus" ? "#f59b45" : "#dce8f2",
      stroke: marker.kind === "focus" ? "#d96f22" : "#8aa0b6",
      "stroke-width": 1.5,
    }));
    svg.append(svgText(marker.label, marker.x, axisY + 31, {
      "font-size": marker.kind === "focus" ? 15 : 13,
      fill: marker.kind === "focus" ? "#bb5e1d" : "#607b95",
    }));
  });
}

/** 绘制中心的凸透镜及其底座。 */
function drawLens(svg) {
  const { lensX, axisY, railY } = geometry;
  const lensTop = axisY - 130;
  const lensBottom = axisY + 130;
  const path = [
    `M ${lensX} ${lensTop}`,
    `C ${lensX - 46} ${axisY - 76}, ${lensX - 46} ${axisY + 76}, ${lensX} ${lensBottom}`,
    `C ${lensX + 46} ${axisY + 76}, ${lensX + 46} ${axisY - 76}, ${lensX} ${lensTop}`,
    "Z",
  ].join(" ");

  svg.append(svgElement("path", {
    d: path,
    fill: "url(#lens-gradient)",
    stroke: "#208ec5",
    "stroke-width": 3,
  }));
  svg.append(svgElement("line", {
    x1: lensX,
    y1: lensTop + 9,
    x2: lensX,
    y2: lensBottom - 9,
    stroke: "#ffffff",
    "stroke-width": 1.5,
    opacity: "0.8",
  }));
  svg.append(svgElement("rect", {
    x: lensX - 37,
    y: railY - 12,
    width: 74,
    height: 12,
    rx: 5,
    fill: "#55738c",
  }));
  svg.append(svgText("凸透镜", lensX, railY + 58, { "font-size": 16, fill: "#176ba2" }));
  svg.append(svgText("O", lensX + 18, axisY - 10, { "font-size": 15, fill: "#286b96" }));
}

/** 绘制可拖动的蜡烛。返回火焰顶端作为光线发射点。 */
function drawCandle(svg, objectX) {
  const { axisY, railY, objectHeight } = geometry;
  const flameTop = axisY - objectHeight;
  const candleTop = flameTop + 43;
  const candleBase = axisY - 9;
  const group = svgElement("g", {
    id: "candle-group",
    role: "button",
    tabindex: "0",
    "aria-label": "蜡烛，可拖动以改变物距",
  });
  group.style.cursor = "grab";

  group.append(svgElement("rect", {
    x: objectX - 33,
    y: railY - 14,
    width: 66,
    height: 15,
    rx: 5,
    fill: "#5b7184",
  }));
  group.append(svgElement("rect", {
    x: objectX - 18,
    y: candleTop,
    width: 36,
    height: candleBase - candleTop,
    rx: 6,
    fill: "#ef6c4d",
    stroke: "#bd4739",
    "stroke-width": 2,
  }));
  group.append(svgElement("path", {
    d: `M ${objectX} ${flameTop} C ${objectX - 20} ${flameTop + 28}, ${objectX - 13} ${flameTop + 45}, ${objectX} ${flameTop + 54} C ${objectX + 15} ${flameTop + 43}, ${objectX + 17} ${flameTop + 24}, ${objectX} ${flameTop} Z`,
    fill: "#ffbf48",
    stroke: "#e87928",
    "stroke-width": 2,
    filter: "url(#glow)",
  }));
  group.append(svgElement("path", {
    d: `M ${objectX} ${flameTop + 16} C ${objectX - 7} ${flameTop + 30}, ${objectX - 3} ${flameTop + 38}, ${objectX} ${flameTop + 42} C ${objectX + 7} ${flameTop + 35}, ${objectX + 7} ${flameTop + 25}, ${objectX} ${flameTop + 16} Z`,
    fill: "#fff7ca",
  }));
  const isCloseToLens = geometry.lensX - objectX < 130;
  group.append(svgText("蜡烛（物体）", isCloseToLens ? objectX - 15 : objectX, railY + 58, {
    "font-size": 16,
    fill: "#a44333",
    "text-anchor": isCloseToLens ? "end" : "middle",
  }));
  svg.append(group);
  return { x: objectX, y: flameTop };
}

/** 绘制实像屏幕或虚像情况下的不可承接光屏提示。 */
function drawScreen(svg, image, scale) {
  const { lensX, axisY, railY, rightEdge, maxVisibleImageDistance } = geometry;
  const isRealAndVisible = image.reality === "实像" && image.imageDistance <= maxVisibleImageDistance;
  const screenX = isRealAndVisible ? lensX + image.imageDistance * scale : rightEdge - 65;
  const group = svgElement("g");
  const screenColor = isRealAndVisible ? "#5d7488" : "#a9bac9";
  const panelColor = isRealAndVisible ? "#e7f6ff" : "#f3f7fa";

  group.append(svgElement("line", {
    x1: screenX,
    y1: axisY - 142,
    x2: screenX,
    y2: axisY + 152,
    stroke: screenColor,
    "stroke-width": 10,
    "stroke-linecap": "round",
  }));
  group.append(svgElement("rect", {
    x: screenX - 13,
    y: axisY - 150,
    width: 26,
    height: 310,
    rx: 5,
    fill: panelColor,
    stroke: screenColor,
    "stroke-width": 2,
  }));
  group.append(svgElement("rect", {
    x: screenX - 34,
    y: railY - 13,
    width: 68,
    height: 13,
    rx: 5,
    fill: "#61788d",
  }));

  let label = "光屏";
  if (image.reality === "虚像") label = "光屏：不能承接虚像";
  if (image.kind === "at-f") label = "光屏：无清晰像";
  if (image.reality === "实像" && !isRealAndVisible) label = `光屏需右移至 v=${formatCentimeters(image.imageDistance)}`;
  group.append(svgText(label, screenX, railY + 58, {
    "font-size": isRealAndVisible ? 15 : 12.5,
    fill: isRealAndVisible ? "#526b82" : "#71889d",
  }));

  if (image.reality === "实像" && !isRealAndVisible) {
    group.append(svgElement("path", {
      d: `M ${rightEdge - 122} ${axisY - 52} H ${rightEdge - 20}`,
      stroke: "#71889d",
      "stroke-width": 2.5,
      "stroke-dasharray": "7 6",
      "marker-end": "url(#small-arrow)",
    }));
    group.append(svgText("像距超出当前光具座范围", rightEdge - 70, axisY - 68, {
      "font-size": 12,
      fill: "#71889d",
    }));
  }
  svg.append(group);
  return { x: screenX, visible: isRealAndVisible };
}

/** 计算直线在指定 x 坐标的 y 值，用于把实际出射光延伸到 SVG 边界。 */
function lineYAtX(from, to, x) {
  if (Math.abs(to.x - from.x) < 0.001) return to.y;
  return from.y + ((x - from.x) * (to.y - from.y)) / (to.x - from.x);
}

/** 单独绘制一条光线，方便统一控制颜色、虚线和透明度。 */
function appendRay(svg, points, color, options = {}) {
  const d = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const ray = svgElement("path", {
    d,
    fill: "none",
    stroke: color,
    "stroke-width": options.width || 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    opacity: options.opacity || "0.9",
  });
  if (options.dashed) ray.setAttribute("stroke-dasharray", "8 7");
  svg.append(ray);
}

/** 绘制实际光线与虚像的反向延长线。 */
function drawRays(svg, objectTop, image, fPx) {
  const { lensX, axisY, rightEdge, objectHeight } = geometry;
  const object = objectTop;
  const lensCenter = { x: lensX, y: axisY };
  const rightFocus = { x: lensX + fPx, y: axisY };
  const leftFocus = { x: lensX - fPx, y: axisY };
  const color1 = "#ee4e8b";
  const color2 = "#6554c0";
  const color3 = "#f49c26";

  if (image.kind === "at-f") {
    // 临界状态：两条常用光线折射后互相平行，提示学生此时像距趋向无穷远。
    const rayOneEnd = { x: rightEdge, y: lineYAtX({ x: lensX, y: object.y }, rightFocus, rightEdge) };
    const rayTwoEnd = { x: rightEdge, y: lineYAtX(object, lensCenter, rightEdge) };
    appendRay(svg, [object, { x: lensX, y: object.y }, rayOneEnd], color1);
    appendRay(svg, [object, lensCenter, rayTwoEnd], color2);
    svg.append(svgText("u = f：出射光线平行，像距趋向无穷远", lensX + 150, axisY - 178, {
      "font-size": 14,
      fill: "#7a638c",
    }));
    return;
  }

  const imagePoint = {
    x: lensX + image.imageDistance * geometry.unitPx,
    y: axisY + image.magnification * (object.y - axisY),
  };
  const rayOneLens = { x: lensX, y: object.y };
  const rayThreeLensY = object.y + ((axisY - object.y) * (lensX - object.x)) / (leftFocus.x - object.x);
  const rayThreeLens = { x: lensX, y: rayThreeLensY };

  if (image.reality === "实像") {
    const visibleImageX = Math.min(imagePoint.x, rightEdge);
    const rayOneEnd = { x: rightEdge, y: lineYAtX(rayOneLens, imagePoint, rightEdge) };
    const rayTwoEnd = { x: rightEdge, y: lineYAtX(lensCenter, imagePoint, rightEdge) };
    const rayThreeEnd = { x: rightEdge, y: rayThreeLens.y };

    appendRay(svg, [object, rayOneLens, { x: visibleImageX, y: lineYAtX(rayOneLens, imagePoint, visibleImageX) }, rayOneEnd], color1);
    appendRay(svg, [object, lensCenter, { x: visibleImageX, y: lineYAtX(lensCenter, imagePoint, visibleImageX) }, rayTwoEnd], color2);
    appendRay(svg, [object, rayThreeLens, { x: visibleImageX, y: rayThreeLens.y }, rayThreeEnd], color3);
  } else {
    // 虚像：实际出射光仍向右传播，虚像由其反向延长线在物侧相交得到。
    const rayOneEnd = { x: rightEdge, y: lineYAtX(rayOneLens, rightFocus, rightEdge) };
    const rayTwoEnd = { x: rightEdge, y: lineYAtX(lensCenter, object, rightEdge) };
    const rayThreeEnd = { x: rightEdge, y: rayThreeLens.y };
    appendRay(svg, [object, rayOneLens, rayOneEnd], color1);
    appendRay(svg, [object, lensCenter, rayTwoEnd], color2);
    appendRay(svg, [object, rayThreeLens, rayThreeEnd], color3);

    appendRay(svg, [rayOneLens, imagePoint], "#6b7280", { dashed: true, width: 2.3, opacity: "0.78" });
    appendRay(svg, [lensCenter, imagePoint], "#6b7280", { dashed: true, width: 2.3, opacity: "0.78" });
    appendRay(svg, [rayThreeLens, imagePoint], "#6b7280", { dashed: true, width: 2.3, opacity: "0.78" });
  }

  // 可读性提示：焦点光线在 u < f 时以“反向延长线经过物方焦点”的方式理解。
  if (image.reality === "虚像") {
    appendRay(svg, [object, leftFocus], color3, { dashed: true, width: 1.8, opacity: "0.47" });
  }
}

/** 在屏幕或物侧绘制箭头形的像。 */
function drawImage(svg, image, screen) {
  if (!Number.isFinite(image.imageDistance)) return;

  const { lensX, axisY, rightEdge, objectHeight, unitPx } = geometry;
  const imageX = lensX + image.imageDistance * unitPx;
  const imageY = axisY + image.magnification * (-objectHeight);
  const visible = image.reality === "虚像" || image.imageDistance <= geometry.maxVisibleImageDistance;
  if (!visible) return;

  const color = image.reality === "实像" ? "#236eb2" : "#8f55a9";
  const arrow = svgElement("g", { opacity: image.reality === "实像" ? "0.95" : "0.82" });
  if (image.reality === "虚像") arrow.setAttribute("stroke-dasharray", "6 5");
  arrow.append(svgElement("line", {
    x1: imageX,
    y1: axisY,
    x2: imageX,
    y2: imageY,
    stroke: color,
    "stroke-width": 5,
    "stroke-linecap": "round",
  }));
  const arrowHead = imageY < axisY
    ? `${imageX},${imageY} ${imageX - 9},${imageY + 17} ${imageX + 9},${imageY + 17}`
    : `${imageX},${imageY} ${imageX - 9},${imageY - 17} ${imageX + 9},${imageY - 17}`;
  arrow.append(svgElement("polygon", { points: arrowHead, fill: color }));
  const imageLabelY = imageY > axisY ? imageY - 20 : imageY - 14;
  arrow.append(svgText(image.reality === "虚像" ? "虚像" : "像", imageX + (imageX > lensX ? 24 : -24), imageLabelY, {
    "font-size": 15,
    fill: color,
  }));
  svg.append(arrow);

  // 实像屏幕上的像投影使用半透明箭头表达，避免掩盖光线交点。
  if (image.reality === "实像" && screen.visible && imageX < rightEdge) {
    svg.append(svgElement("circle", {
      cx: imageX,
      cy: imageY,
      r: 5,
      fill: "#0d70b8",
      opacity: "0.65",
    }));
  }
}

/** 把控制器状态、光学计算和舞台绘图串联起来。 */
function render() {
  const image = getImageData(state.objectDistance, state.focalLength);
  const { lensX, unitPx } = geometry;
  const objectX = lensX - state.objectDistance * unitPx;
  const fPx = state.focalLength * unitPx;

  stage.replaceChildren();
  addDefinitions(stage);
  drawBench(stage);
  drawFocalMarkers(stage, fPx);
  const screen = drawScreen(stage, image, unitPx);
  const objectTop = drawCandle(stage, objectX);
  drawRays(stage, objectTop, image, fPx);
  drawLens(stage);
  drawImage(stage, image, screen);
  updateDashboard(image);

  // 手机端光具座采用横向滑动显示；首次打开时自动把镜头附近置于可视区域中央。
  if (window.matchMedia("(max-width: 620px)").matches && !stageWrap.dataset.initialAligned) {
    requestAnimationFrame(() => {
      const renderedStageWidth = 720;
      const lensPosition = (geometry.lensX / geometry.width) * renderedStageWidth;
      stageWrap.scrollLeft = Math.max(0, lensPosition - stageWrap.clientWidth / 2);
      stageWrap.dataset.initialAligned = "true";
    });
  }
}

/** 从滑动条同步状态并刷新。 */
function syncFromControls() {
  state.objectDistance = Number(objectDistanceInput.value);
  state.focalLength = Number(focalLengthInput.value);
  render();
}

/** 设置物距时确保处于滑动条允许范围。 */
function setObjectDistance(value) {
  const min = Number(objectDistanceInput.min);
  const max = Number(objectDistanceInput.max);
  const next = Math.round(Math.min(max, Math.max(min, value)));
  state.objectDistance = next;
  objectDistanceInput.value = String(next);
  render();
}

/** 设置焦距，并将数值限定在 5—15 cm 的实验范围。 */
function setFocalLength(value) {
  const min = Number(focalLengthInput.min);
  const max = Number(focalLengthInput.max);
  const next = Math.round(Math.min(max, Math.max(min, value)));
  state.focalLength = next;
  focalLengthInput.value = String(next);
  render();
}

/** 将数字输入框的值同步到滑动条；输入为空时保持当前实验状态。 */
function syncNumberInput(input, setter) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    input.value = input === objectDistanceNumber
      ? String(state.objectDistance)
      : String(state.focalLength);
    return;
  }
  setter(value);
}

/** 快捷按钮：针对当前焦距设置五个典型物距情形。 */
function applyQuickMode(mode) {
  const f = state.focalLength;
  const max = Number(objectDistanceInput.max);
  const fallbackOutside = Math.min(max, 2 * f + 5);
  const values = {
    outside: fallbackOutside,
    double: Math.min(max, 2 * f),
    between: Math.min(max, f + Math.max(1, Math.floor(f / 2))),
    focus: f,
    inside: Math.max(Number(objectDistanceInput.min), f - Math.max(1, Math.floor(f / 2))),
  };
  setObjectDistance(values[mode]);
}

/**
 * 处理蜡烛拖动。SVG 使用 viewBox，需把屏幕像素坐标转回 viewBox 坐标。
 */
function getSvgPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * geometry.width,
    y: ((event.clientY - rect.top) / rect.height) * geometry.height,
  };
}

let dragging = false;

stage.addEventListener("pointerdown", (event) => {
  const candle = event.target.closest?.("#candle-group");
  if (!candle) return;
  dragging = true;
  stage.setPointerCapture(event.pointerId);
  candle.style.cursor = "grabbing";
  event.preventDefault();
});

stage.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const point = getSvgPoint(event);
  const distance = (geometry.lensX - point.x) / geometry.unitPx;
  setObjectDistance(distance);
});

function stopDragging(event) {
  if (!dragging) return;
  dragging = false;
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
}

stage.addEventListener("pointerup", stopDragging);
stage.addEventListener("pointercancel", stopDragging);

objectDistanceInput.addEventListener("input", syncFromControls);
focalLengthInput.addEventListener("input", syncFromControls);
objectDistanceNumber.addEventListener("change", () => syncNumberInput(objectDistanceNumber, setObjectDistance));
focalLengthNumber.addEventListener("change", () => syncNumberInput(focalLengthNumber, setFocalLength));
objectDistanceNumber.addEventListener("keydown", (event) => {
  if (event.key === "Enter") objectDistanceNumber.blur();
});
focalLengthNumber.addEventListener("keydown", (event) => {
  if (event.key === "Enter") focalLengthNumber.blur();
});

document.querySelectorAll("[data-step-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const change = Number(button.dataset.stepChange);
    if (button.dataset.stepTarget === "object-distance") {
      setObjectDistance(state.objectDistance + change);
    } else {
      setFocalLength(state.focalLength + change);
    }
  });
});

resetButton.addEventListener("click", () => {
  state.objectDistance = state.defaults.objectDistance;
  state.focalLength = state.defaults.focalLength;
  render();
});

document.querySelectorAll("[data-u-mode]").forEach((button) => {
  button.addEventListener("click", () => applyQuickMode(button.dataset.uMode));
});

/**
 * 可选的 URL 参数方便教师预设演示情形，例如 index.html?u=15&f=10。
 * 不带参数时仍使用默认值，不影响直接双击打开网页的方式。
 */
function applyLaunchParameters() {
  const parameters = new URLSearchParams(window.location.search);
  const u = Number(parameters.get("u"));
  const f = Number(parameters.get("f"));
  const uMin = Number(objectDistanceInput.min);
  const uMax = Number(objectDistanceInput.max);
  const fMin = Number(focalLengthInput.min);
  const fMax = Number(focalLengthInput.max);

  if (Number.isInteger(u) && u >= uMin && u <= uMax) state.objectDistance = u;
  if (Number.isInteger(f) && f >= fMin && f <= fMax) state.focalLength = f;
  objectDistanceInput.value = String(state.objectDistance);
  focalLengthInput.value = String(state.focalLength);
}

// ===== 后续扩展入口 =====
// 1. 练习模式：读取 getImageData 的 relation/orientation/size/reality 进行判题。
// 2. 实验记录：在 render 后把 state 与 image 推入记录数组并导出为 CSV。
// 3. 其他实验：保留现有 state + calculation + render 的三层结构即可复用页面框架。

applyLaunchParameters();
render();
