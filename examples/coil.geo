SetFactory("OpenCASCADE");

coreLe = 0.001 * 0.5;
coilLe = 0.001 * 0.1;
airR = 0.1;
airLe = 0.005;

// 鉄心: x=[0, 0.005], y=[-0.01, 0.01]
ironCore = newreg;
Rectangle(ironCore) = {0, -0.01, 0, 0.005, 0.02};

// コイル: 中心 (0.006, 0), 半径 0.0005
coil = newreg;
Disk(coil) = {0.006, 0, 0, 0.0005, 0.0005};

// 空気領域: x=[0, airR], y=[-airR, airR]
airBox = newreg;
Rectangle(airBox) = {0, -airR, 0, airR, 2 * airR};

// 矩形から ironCore と coil を差し引き、共有境界のメッシュを一致させる
frags() = BooleanFragments{ Surface{airBox}; Delete; }{ Surface{ironCore, coil}; Delete; };

// 分割後の各領域を BoundingBox で確実に特定する
eps = 1e-6;
ironCore_s() = Surface In BoundingBox{0 - eps, -0.01 - eps, -eps, 0.005 + eps, 0.01 + eps, eps};
coil_s() = Surface In BoundingBox{0.0055 - eps, -0.0005 - eps, -eps, 0.0065 + eps, 0.0005 + eps, eps};
air_s() = frags();
air_s() -= ironCore_s();
air_s() -= coil_s();

// メッシュサイズ設定（外側から内側の順に指定し、境界を細かいサイズにする）
Characteristic Length { PointsOf{ Surface{air_s()}; } } = airLe;
Characteristic Length { PointsOf{ Surface{ironCore_s()}; } } = coreLe;
Characteristic Length { PointsOf{ Surface{coil_s()}; } } = coilLe;

Physical Surface("ironCore", 1) = {ironCore_s()};
Physical Surface("coil", 2) = {coil_s()};
Physical Surface("air", 3) = {air_s()};

// 境界条件用の Physical Curve（対称軸 x=0 と外部境界）
axis_c() = Curve In BoundingBox{0 - eps, -airR - eps, -eps, 0 + eps, airR + eps, eps};
outer_c() = {
  Curve In BoundingBox{0 - eps, -airR - eps, -eps, airR + eps, -airR + eps, eps},
  Curve In BoundingBox{airR - eps, -airR - eps, -eps, airR + eps, airR + eps, eps},
  Curve In BoundingBox{0 - eps, airR - eps, -eps, airR + eps, airR + eps, eps}
};
Physical Curve("axis", 1) = {axis_c()};
Physical Curve("outer", 2) = {outer_c()};
