// 3D CAD Shapes using OpenCASCADE geometry engine
SetFactory("OpenCASCADE");

fillet_radius = 0.1;

// Create a box
Box(1) = {0, 0, 0, 2, 2, 1};

// Fillet edges of the box
f() = Boundary{ Volume{1}; };
e() = Unique(Boundary{ Surface{f()}; });
Fillet{1}{e()}{fillet_radius}

// Create a cylinder cut through the box
Cylinder(2) = {1, 1, -0.5, 0, 0, 2, 0.3};

// Boolean difference: Box minus Cylinder
BooleanDifference{ Volume{1}; Delete; }{ Volume{2}; Delete; }

