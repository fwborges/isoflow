import { makeAutoObservable } from "mobx";
import Paper, { Group } from "paper";
import gsap from "gsap";
import { Grid } from "./elements/Grid";
import { Cursor } from "./elements/Cursor";
import { PROJECTED_TILE_WIDTH, PROJECTED_TILE_HEIGHT } from "./constants";
import { clamp } from "../utils";
import { Nodes } from "./elements/Nodes";
import { SceneI, IconI } from "../validation/SceneSchema";
import { Coords } from "./elements/Coords";
import { OnSceneChange, SceneEventI } from "../types";

interface Config {
  icons: IconI[];
}

export class Renderer {
  activeLayer: paper.Layer;
  zoom = 1;

  config: Config = {
    icons: [],
  };
  callbacks: {
    emitEvent: OnSceneChange;
  };
  groups: {
    container: paper.Group;
    elements: paper.Group;
  };
  sceneElements: {
    grid: Grid;
    cursor: Cursor;
    nodes: Nodes;
  };
  domElements: {
    container: HTMLDivElement;
    canvas: HTMLCanvasElement;
  };
  scrollPosition = {
    x: 0,
    y: 0,
  };
  rafRef?: number;

  constructor(containerEl: HTMLDivElement) {
    makeAutoObservable(this);

    Paper.settings = {
      insertelements: false,
      applyMatrix: false,
    };

    this.callbacks = {
      emitEvent: () => {},
    };

    this.domElements = {
      container: containerEl,
      ...this.initDOM(containerEl),
    };

    Paper.setup(this.domElements.canvas);

    this.sceneElements = {
      grid: new Grid(new Coords(51, 51), this),
      cursor: new Cursor(this),
      nodes: new Nodes(this),
    };

    this.groups = {
      container: new Group(),
      elements: new Group(),
    };

    this.groups.elements.addChild(this.sceneElements.grid.container);
    this.groups.elements.addChild(this.sceneElements.cursor.container);
    this.groups.elements.addChild(this.sceneElements.nodes.container);

    this.groups.container.addChild(this.groups.elements);
    this.groups.container.set({ position: [0, 0] });

    this.activeLayer = Paper.project.activeLayer;
    this.activeLayer.addChild(this.groups.container);

    this.scrollTo(0, 0);

    this.render();

    this.init();
  }

  init() {}

  setEventHandler(eventHandler: OnSceneChange) {
    this.callbacks.emitEvent = eventHandler;
  }

  loadScene(scene: SceneI) {
    this.config.icons = scene.icons;

    scene.nodes.forEach((node) => {
      this.sceneElements.nodes.addNode(node);
    });
  }

  getIconById(id: string) {
    const icon = this.config.icons.find((icon) => icon.id === id);

    if (!icon) {
      throw new Error(`Icon not found: ${id}`);
    }

    return icon;
  }

  initDOM(containerEl: HTMLDivElement) {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.setAttribute("resize", "true");
    containerEl.appendChild(canvas);

    return { canvas };
  }

  getTileFromMouse(mouse: Coords) {
    const halfW = PROJECTED_TILE_WIDTH / 2;
    const halfH = PROJECTED_TILE_HEIGHT / 2;

    const mouseX =
      (mouse.x - this.groups.elements.position.x) * (1 / this.zoom);
    const mouseY =
      (mouse.y - this.groups.elements.position.y) * (1 / this.zoom) + halfH;

    const row = Math.floor((mouseX / halfW + mouseY / halfH) / 2);
    const col = Math.floor((mouseY / halfH - mouseX / halfW) / 2);

    const halfRowNum = Math.floor(this.sceneElements.grid.size.x * 0.5);
    const halfColNum = Math.floor(this.sceneElements.grid.size.y * 0.5);

    return new Coords(
      clamp(row, -halfRowNum, halfRowNum),
      clamp(col, -halfColNum, halfColNum)
    );
  }

  getTilePosition({ x, y }: Coords) {
    const halfW = PROJECTED_TILE_WIDTH * 0.5;
    const halfH = PROJECTED_TILE_HEIGHT * 0.5;

    return new Coords(x * halfW - y * halfW, x * halfH + y * halfH);
  }

  getTileBounds(coords: Coords) {
    const position = this.getTilePosition(coords);

    return {
      left: {
        x: position.x - PROJECTED_TILE_WIDTH * 0.5,
        y: position.y,
      },
      right: {
        x: position.x + PROJECTED_TILE_WIDTH * 0.5,
        y: position.y,
      },
      top: { x: position.x, y: position.y - PROJECTED_TILE_HEIGHT * 0.5 },
      bottom: { x: position.x, y: position.y + PROJECTED_TILE_HEIGHT * 0.5 },
      center: { x: position.x, y: position.y },
    };
  }

  getTileScreenPosition(position: Coords) {
    const { width: viewW, height: viewH } = Paper.view.bounds;
    const { offsetLeft: offsetX, offsetTop: offsetY } = this.domElements.canvas;
    const tilePosition = this.getTileBounds(position).center;
    const globalItemsGroupPosition = this.groups.elements.globalToLocal([0, 0]);
    const screenPosition = new Coords(
      (tilePosition.x +
        this.scrollPosition.x +
        globalItemsGroupPosition.x +
        this.groups.elements.position.x +
        viewW * 0.5) *
        this.zoom +
        offsetX,

      (tilePosition.y +
        this.scrollPosition.y +
        globalItemsGroupPosition.y +
        this.groups.elements.position.y +
        viewH * 0.5) *
        this.zoom +
        offsetY
    );

    return screenPosition;
  }

  setGrid(width: number, height: number) {}

  setZoom(zoom: number) {
    this.zoom = zoom;

    gsap.killTweensOf(Paper.view);
    gsap.to(Paper.view, {
      duration: 0.3,
      zoom: this.zoom,
    });

    this.emitEvent({
      type: "ZOOM_CHANGED",
      data: { level: zoom },
    });
  }

  scrollTo(x: number, y: number) {
    this.scrollPosition = { x, y };

    const { center: viewCenter } = Paper.view.bounds;

    const newPosition = {
      x: x + viewCenter.x,
      y: y + viewCenter.y,
    };

    gsap.to(this.groups.elements.position, {
      duration: 0,
      ...newPosition,
    });
  }

  scrollToDelta(deltaX: number, deltaY: number) {
    this.scrollTo(
      this.scrollPosition.x + deltaX * (1 / this.zoom),
      this.scrollPosition.y + deltaY * (1 / this.zoom)
    );
  }

  unfocusAll() {
    this.sceneElements.nodes.unfocusAll();
  }

  clear() {
    this.sceneElements.nodes.clear();
  }

  destroy() {
    this.domElements.canvas.remove();

    if (this.rafRef !== undefined) global.cancelAnimationFrame(this.rafRef);
  }

  render() {
    if (Paper.view) {
      if (global.requestAnimationFrame) {
        this.rafRef = global.requestAnimationFrame(this.render.bind(this));
      }

      Paper.view.update();
    }
  }

  exportScene(): SceneI {
    const exported = {
      icons: this.config.icons,
      nodes: this.sceneElements.nodes.export(),
      groups: [],
      connectors: [],
    };

    return exported;
  }

  emitEvent(event: SceneEventI) {
    this.callbacks.emitEvent(event);
  }

  getItemsByTile(coords: Coords) {
    const node = this.sceneElements.nodes.getNodeByTile(coords);

    return [node].filter((i) => Boolean(i));
  }
}
