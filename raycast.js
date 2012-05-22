// -- 2D VECTOR ---------------------------------------------------------------

var Vector2d = function(x, y) {
    this.x = x;
    this.y = y;
};

Vector2d.prototype.rotateBy = function(ang) {
    var c = Math.cos(ang),
        s = Math.sin(ang),
        x = this.x * c - this.y * s;
        y = this.x * s + this.y * c;
    return new Vector2d(x, y);
};

Vector2d.prototype.norm = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
};

// -- 2D MATRIX ---------------------------------------------------------------

var Matrix2d = function(a, b, c, d) {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
};

Matrix2d.prototype.determinant = function() {
    return this.a * this.d - this.b * this.c;
};

Matrix2d.prototype.invert = function() {
    var det = this.determinant();
    if (det == 0)
        return undefined;

    return new Matrix2d( this.d / det, -this.b / det,
                        -this.c / det,  this.a / det);
};

Matrix2d.prototype.leftMultVector = function(vec) {
    return new Vector2d(this.a * vec.x + this.b * vec.y,
                        this.c * vec.x + this.d * vec.y);
};

// -- LINE --------------------------------------------------------------------

var Line = function(start, dir) {
    this.start = start;
    this.dir   = dir;
};

Line.prototype.intersect = function(other) {
    var A = new Matrix2d(this.dir.x, -other.dir.x,
                         this.dir.y, -other.dir.y),
        b = new Vector2d(other.start.x - this.start.x,
                         other.start.y - this.start.y),
        inv, ts;

    inv = A.invert();
    if (!inv)
        return [-1, -1];

    ts = inv.leftMultVector(b);
    return [ts.x, ts.y];
};

Line.prototype.distToPoint = function(p, debug) {
    // dist = | (start - pt) - ((start - pt).dot(n))*n |
    //   where n = dir.normalized()
    var ap   = new Vector2d(this.start.x - p.x, this.start.y - p.y),
        norm = Math.sqrt(this.dir.norm()),
        n    = new Vector2d(this.dir.x / norm, this.dir.y / norm),
        apn  = ap.x * n.x + ap.y * n.y,
        apnn = new Vector2d(apn * n.x, apn * n.y),
        perp = new Vector2d(ap.x - apnn.x, ap.y - apnn.y);

    return perp.norm();
};

// -- COLOR -------------------------------------------------------------------

var Color = function(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;

    this.canvasColor = 'rgb(' +
        (r * 255) + ',' + (g * 255) + ',' + (b * 255) + ')';
};

// -- DATA --------------------------------------------------------------------

var rawMap = {
    walls: [
        { start: [0.0, 0.5], end: [0.2, 0.5], color: [1, 0, 0] },
        { start: [0.2, 0.5], end: [0.2, 0.3], color: [0, 1, 0] },
        { start: [0.2, 0.3], end: [0.8, 0.3], color: [0, 0, 1] },
        { start: [0.8, 0.3], end: [0.8, 0.5], color: [1, 1, 0] },
        { start: [0.8, 0.5], end: [1.0, 0.5], color: [0, 1, 1] }
    ]
};

var map = { walls: [] };

var player = {
    pos: new Vector2d(0.5,  0.7),
    dir: new Vector2d(0.0, -1.0),
    fov: Math.PI / 2
};

// -- MAIN FUNCTIONALITY ------------------------------------------------------

var processRawMap = function() {
    var wall, start, end, color;

    map = { walls: [] };
    rawMap.walls.forEach(function(rawWall) {
        start = new Vector2d(rawWall.start[0], rawWall.start[1]);
        dir   = new Vector2d(
            rawWall.end[0] - start.x, rawWall.end[1] - start.y);

        color = new Color(
            rawWall.color[0], rawWall.color[1], rawWall.color[2]);

        wall = {line: new Line(start, dir), color: color};
        map.walls.push(wall);
    });
};

var attachEvents = function() {
    document.addEventListener('keydown', function(evt) {
        var keyCode = evt.keyCode || evt.which,
        arrow = {left: 37, up: 38, right: 39, down: 40 };

        switch (keyCode) {
        case arrow.left:
            player.dir = player.dir.rotateBy(-0.087);
            redraw();
            break;
        case arrow.right:
            player.dir = player.dir.rotateBy( 0.087);
            redraw();
            break;
        case arrow.up:
            if (attemptMove( 0.05))
                redraw();
            break;
        case arrow.down:
            if (attemptMove(-0.05))
                redraw();
            break;
        }
    });
};

var attemptMove = function(dist) {
    // TODO: actually, use a line segment for the move and use intersection
    //       to determine collision
    var newPos = new Vector2d(player.pos.x + player.dir.x * dist,
                              player.pos.y + player.dir.y * dist);

    for (var i = 0; i < map.walls.length; i++)
        if (map.walls[i].line.distToPoint(newPos) < 0.1)
            return false;

    player.pos = newPos;
    return true;
};

var redraw = function() {
    var viewport = document.getElementById('viewport');
    var hits = castRays(viewport.width);
    drawColumns(viewport, hits);
};

document.addEventListener('DOMContentLoaded', function() {
    processRawMap();
    attachEvents();
    redraw();
});

var castRays = function(nrays) {
    var dAng = player.fov / nrays,
        ang, dir, ray,
        hits = [];

    for (var i = 0; i < nrays; i++) {
        ang = -player.fov / 2 + dAng * i + dAng / 2;
        dir = player.dir.rotateBy(ang);
        ray = new Line(player.pos, dir);

        hits.push(castOneRay(ray));
    }
    return hits;
};

var castOneRay = function(ray) {
    var ts,
        minT = Infinity, closestWall = undefined;

    map.walls.forEach(function(wall) {
        ts = ray.intersect(wall.line);

        if (ts[0] < 0)
            return;
        if (ts[1] < 0 || ts[1] > 1)
            return;

        if (ts[0] < minT) {
            minT = ts[0];
            closestWall = wall;
        }
    });

    if (closestWall !== undefined)
        return {t: minT, wall: closestWall}
    return undefined;
};

var drawColumns = function(canv, hits) {
    var hit, x, h,
        ctx = canv.getContext('2d');

    ctx.lineWidth = 1;

    for (var i = 0; i < canv.width; i++) {
        x   = i + 0.5;

        // 1. draw sky
        ctx.beginPath();
        ctx.strokeStyle = '#8080FF';
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canv.height / 2);
        ctx.stroke();

        // 2. draw ground
        ctx.beginPath();
        ctx.strokeStyle = '#FF8000';
        ctx.moveTo(x, canv.height / 2);
        ctx.lineTo(x, canv.height);
        ctx.stroke();

        // 3. draw wall if necessary
        hit = hits[i];
        if (hit === undefined)
            continue;

        h = (-1 * hit.t + 1) * canv.height;
        if (h <= 0)
            continue;

        ctx.beginPath();
        ctx.strokeStyle = hit.wall.color.canvasColor;
        ctx.moveTo(x, (canv.height - h) / 2);
        ctx.lineTo(x, (canv.height + h) / 2);
        ctx.stroke();
    }
};
