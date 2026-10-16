// 3D CAD Shapes using OpenCASCADE geometry engine
SetFactory("OpenCASCADE");

// Create a box
Box(1) = {0, 0, 0, 2, 2, 1};

// Create a cylinder cut through the box
Cylinder(2) = {1, 1, -0.5, 0, 0, 2, 0.5};

// Boolean difference: Box minus Cylinder
BooleanDifference{ Volume{1}; Delete; }{ Volume{2}; Delete; }
