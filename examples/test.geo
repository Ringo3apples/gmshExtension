SetFactory("OpenCASCADE");

// 原点（球の中心）
Point(1) = {0, 0, 0};

// 球面上の3頂点（R=1 の北極と赤道上の2点）
Point(2) = {1, 0, 0}; // X軸
Point(3) = {0, 1, 0}; // Y軸
Point(4) = {0, 0, 1}; // Z軸（北極）

// 3本の円弧（大円の弧）
Circle(1) = {2, 1, 3}; // 赤道（X -> Y）
Circle(2) = {3, 1, 4}; // 子午線（Y -> Z）
Circle(3) = {4, 1, 2}; // 子午線（Z -> X）

// 3本の円弧で閉じたループ
Curve Loop(1) = {1, 2, 3};

// 球面パッチを作成！
Surface(1) = {1};



Point(1) = {0, 0, 0};
Point(2) = { 1, 0, 0};
Point(3) = { 0,  1, 0};


Point(4) = {0, 0, 1};
Point(5) = { 1, 0, 1};
Point(6) = { 0,  1, 1};

Circle(1) = {2, 1, 3};
Circle(2) = {5, 4, 6};

Line(3) = {3, 6};
Line(4) = {5, 2};

Curve Loop(1) = {1, 3, -2, 4};

Surface(1) = {1};


Point(7) = {0, 1, -1};
Point(8) = { 1, 1, -1};
Point(9) = { 0,  2, -1};

Circle(5) = {8, 7, 9};

out[] = Extrude {0, 0, 1} {
  Curve{5};
};

// コンソール（またはGmshのログウィンドウ）に各IDを表示！
Printf("Top curve ID: %g", out[0]);
Printf("Surface ID:   %g", out[1]);
Printf("Side edge 1:  %g", out[2]);
Printf("Side edge 2:  %g", out[3]);
