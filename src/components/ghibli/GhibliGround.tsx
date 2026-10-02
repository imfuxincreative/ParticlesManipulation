import React from 'react';
import * as THREE from 'three';

interface GhibliGroundProps {
  color?: string;
  size?: number;
}

export const GhibliGround: React.FC<GhibliGroundProps> = ({
  color = '#2d5447',
  size = 100,
}) => {
  return (
    <group>
      {/* Ground Plane with Base Color */}
      <mesh
        receiveShadow
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color={color}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Shadow Material Overlay for crisp Ghibli ground shadows */}
      <mesh
        receiveShadow
        position={[0, -0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size, size]} />
        <shadowMaterial opacity={0.35} color="#0f2420" />
      </mesh>
    </group>
  );
};
