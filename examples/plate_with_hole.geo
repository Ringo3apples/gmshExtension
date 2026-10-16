// Plate with central circular hole
lc = 0.15;
R = 0.3;

// Outer boundary points
Point(1) = {-1, -1, 0, lc};
Point(2) = { 1, -1, 0, lc};
Point(3) = { 1,  1, 0, lc};
Point(4) = {-1,  1, 0, lc};

// Center and hole circle points
Point(5) = {0, 0, 0, lc};
Point(6) = {R, 0, 0, lc};
Point(7) = {0, R, 0, lc};
Point(8) = {-R, 0, 0, lc};
Point(9) = {0, -R, 0, lc};

// Outer lines
Line(1) = {1, 2};
Line(2) = {2, 3};
Line(3) = {3, 4};
Line(4) = {4, 1};

// Inner circular arcs
Circle(5) = {6, 5, 7};
Circle(6) = {7, 5, 8};
Circle(7) = {8, 5, 9};
Circle(8) = {9, 5, 6};

// Loops
Curve Loop(1) = {1, 2, 3, 4};
Curve Loop(2) = {5, 6, 7, 8};

// Surface with hole (outer loop minus inner loop)
Plane Surface(1) = {1, 2};
