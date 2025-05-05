import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

function rectangle(x, y, w, h) {
    const s = new THREE.Path();
    s.moveTo(x, y);
    s.lineTo(x + w, y);
    s.lineTo(x + w, y + h);
    s.lineTo(x, y + h);
    s.lineTo(x, y);
    return s;
}

function quad(x, y, w, h, x_offset, y_offset) {
    const s = new THREE.Path();
    s.moveTo(x - (w * (1 - x_offset)), y);
    s.lineTo(x, y - (h * (1 - y_offset)));
    s.lineTo(x + (w * x_offset), y);
    s.lineTo(x, y + (h * y_offset));
    s.lineTo(x - (w * (1 - x_offset)), y);
    return s;
}

export function addRectangle(shape, x, y, w, h, thickness = 1) {
    shape.add(rectangle(x, y, w, h));
    //not use holes but use directly bvh
    //shape.holes.push(rectangle(x+thickness,y+thickness,w-2*thickness,h-2*thickness));
    const hole = new THREE.BoxGeometry(w - thickness, 7, h - thickness);
    hole.translate(x + w / 2, 3.5, -(y + h / 2));
    //room.add(new THREE.Mesh(hole));
    hole.pos = [x, y];
    shape.holesGeom.push(hole);
}

export function addQuad(shape, x, y, w, h, xo, yo, thickness = 2) {
    shape.add(quad(x, y, w, h, xo, yo));
    const hs = new THREE.Shape();
    hs.add(quad(x, y, w - thickness, h - thickness, xo, yo));
    const hole = new THREE.ExtrudeGeometry(
        hs,
        {
            steps: 1,
            depth: 7,
        },
    );
    hole.rotateX(-Math.PI / 2);
    //hole.translate(x,0,-y);
    hole.pos = [x, y];
    //room.add(new Brush(hole));
    shape.holesGeom.push(hole);
    //shape.holes.push(quad(x,y,w-1,h-1,xo,yo));
}
