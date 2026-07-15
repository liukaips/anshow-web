"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function RouteSceneClient() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 7.2);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.append(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = -0.08;
    scene.add(group);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.4, -0.5, 0),
      new THREE.Vector3(-2.8, 0.85, -0.2),
      new THREE.Vector3(-0.8, -0.2, 0.25),
      new THREE.Vector3(1.25, 0.65, -0.15),
      new THREE.Vector3(3.05, -0.45, 0.15),
      new THREE.Vector3(4.4, 0.35, 0),
    ]);
    const points = curve.getPoints(220);
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    routeGeometry.setDrawRange(0, 1);
    const routeMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const route = new THREE.Line(routeGeometry, routeMaterial);
    group.add(route);

    const shadowGeometry = new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(point.x, point.y - 0.08, point.z - 0.05)),
    );
    const shadowMaterial = new THREE.LineBasicMaterial({ color: 0x123b4b, transparent: true, opacity: 0.7 });
    group.add(new THREE.Line(shadowGeometry, shadowMaterial));

    const nodeGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const nodes = [0, 44, 88, 132, 176, 220].map((pointIndex, index) => {
      const node = new THREE.Mesh(nodeGeometry, index === 5 ? new THREE.MeshBasicMaterial({ color: 0x14b8a6 }) : nodeMaterial);
      node.position.copy(points[pointIndex]);
      group.add(node);
      return node;
    });

    const cargoGeometry = new THREE.BoxGeometry(0.34, 0.2, 0.2);
    const cargoMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const cargo = new THREE.Mesh(cargoGeometry, cargoMaterial);
    group.add(cargo);

    const starPositions: number[] = [];
    for (let index = 0; index < 110; index += 1) {
      const x = ((index * 73) % 211) / 211;
      const y = ((index * 47) % 127) / 127;
      starPositions.push((x - 0.5) * 11, (y - 0.5) * 4.2, -1.5 - (index % 4) * 0.25);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x47606d, size: 0.025 });
    scene.add(new THREE.Points(starsGeometry, starsMaterial));

    const render = () => renderer.render(scene, camera);
    const resize = () => {
      const width = element.clientWidth;
      const height = Math.max(element.clientHeight, 416);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    resize();

    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const raw = Math.min(1, (now - start) / 1800);
      const progress = 1 - Math.pow(1 - raw, 3);
      routeGeometry.setDrawRange(0, Math.max(1, Math.floor(progress * points.length)));
      cargo.position.copy(curve.getPointAt(progress));
      cargo.rotation.z = progress * 0.35;
      nodes.forEach((node, index) => {
        const active = progress >= index / (nodes.length - 1);
        node.scale.setScalar(active ? 1 : 0.35);
      });
      render();
      if (raw < 1) frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      routeGeometry.dispose();
      routeMaterial.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      nodes.forEach((node) => {
        if (node.material !== nodeMaterial) node.material.dispose();
      });
      cargoGeometry.dispose();
      cargoMaterial.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="absolute inset-0 min-h-[26rem] w-full" data-route-canvas ref={host} />;
}

