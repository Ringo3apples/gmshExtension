// Simple 2D Plate Example for Gmsh
lc = 0.2;

// Corner points
Point(1) = {0, 0, 0, lc};
Point(2) = {2, 0, 0, lc};
Point(3) = {2, 1, 0, lc};
Point(4) = {0, 1, 0, lc};

// Boundary lines
Line(1) = {1, 2};
Line(2) = {2, 3};
Line(3) = {3, 4};
Line(4) = {4, 1};

// Curve Loop & Plane Surface
Curve Loop(1) = {1, 2, 3, 4};
Plane Surface(1) = {1};

// Physical tags (optional for FEM export)
Physical Curve("Bottom") = {1};
Physical Curve("Right") = {2};
Physical Curve("Top") = {3};
Physical Curve("Left") = {4};
Physical Surface("Plate") = {1};
