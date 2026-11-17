SetFactory("OpenCASCADE");

// 原点（球の中心）
Point(1) = {0, 0, 0};

// 球面上の3頂点（R=1 の北極と赤道上の2点）
Point(2) = {1, 0, 0, 0.1}; // X軸
Point(3) = {0, 1, 0, 0.1}; // Y軸
Point(4) = {0, 0, 1, 0.1}; // Z軸（北極）

// 3本の円弧（大円の弧）
Circle(1) = {2, 1, 3}; // 赤道（X -> Y）
Circle(2) = {3, 1, 4}; // 子午線（Y -> Z）
Circle(3) = {4, 1, 2}; // 子午線（Z -> X）

// 3本の円弧で閉じたループ
Curve Loop(1) = {1, 2, 3};

// 球面パッチを作成！
Surface(1) = {1};

Physical Surface("test", 1) = {1};
Physical Curve("testCurve", 2) = {1, 2, 3};

Point(7) = {0, 0, -0.1, 0.1};
Point(8) = { 1, 0, -0.1, 0.1};
Point(9) = { 0,  1, -0.1, 0.1};

Circle(4) = {8, 7, 9};

out[] = Extrude {0, 0, -0.3} {Curve{4};};
Physical Surface("side", 3) = {out[1]};

Physical Curve("sideCurve", 4) = {4};
