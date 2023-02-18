//Renderer Elements
var ctx = document.body.appendChild(document.createElement('canvas')).getContext('2d'),
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

document.body.appendChild(renderer.domElement);
renderer.domElement.style.position =
  ctx.canvas.style.position = 'fixed';
ctx.canvas.style.background = 'black';

function resize() {
  var ratio = 16 / 9,
    preHeight = window.innerWidth / ratio;

  if (preHeight <= window.innerHeight) {
    renderer.setSize(window.innerWidth, preHeight);
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = preHeight;
  } else {
    var newWidth = Math.floor(window.innerWidth - (preHeight - window.innerHeight) * ratio);
    newWidth -= newWidth % 2 !== 0 ? 1 : 0;
    renderer.setSize(newWidth, newWidth / ratio);
    ctx.canvas.width = newWidth;
    ctx.canvas.height = newWidth / ratio;
  }

  renderer.domElement.style.width = '';
  renderer.domElement.style.height = '';
  renderer.domElement.style.left = ctx.canvas.style.left = (window.innerWidth - renderer.domElement.width) / 2 + 'px';
  renderer.domElement.style.top = ctx.canvas.style.top = (window.innerHeight - renderer.domElement.height) / 2 + 'px';
}

window.addEventListener('resize', resize);

resize();

//Scene and Camera
var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera(
  20, // Field of view
  16 / 9, // Aspect ratio
  0.1, // Near plane
  10000 // Far plane
);

camera.position.set(700, 235, 0);

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 1;

//Objects
var starColor = (function() {
    var colors = [0xFFFF00, 0x559999, 0xFF6339, 0xFFFFFF];
    return colors[Math.floor(Math.random() * colors.length)];
  })(),
  star = new THREE.Mesh(
    new THREE.IcosahedronGeometry(7, 1),
    new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
    })
  ),
  glows = [];

star.castShadow = false;
scene.add(star);

for (var i = 1, scaleX = 1.1, scaleY = 1.1, scaleZ = 1.1; i < 5; i++) {
  var starGlow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(7, 1),
    new THREE.MeshBasicMaterial({
      color: starColor,
      transparent: true,
      opacity: 0.5
    })
  );
  starGlow.castShadow = false;
  scaleX += 0.4 + Math.random() * .5;
  scaleY += 0.4 + Math.random() * .5;
  scaleZ += 0.4 + Math.random() * .5;
  starGlow.scale.set(scaleX, scaleY, scaleZ);
  starGlow.origScale = {
    x: scaleX,
    y: scaleY,
    z: scaleZ
  };
  glows.push(starGlow);
  scene.add(starGlow);
}

var planetColors = [
    0x333333, //grey
    0x993333, //ruddy
    0xAA8239, //tan
    0x2D4671, //blue
    0x599532, //green
    0x267257 //bluegreen
  ],
  planets = [];

for (var p = 0, radii = 0; p < 5; p++) {
  var size = 4 + Math.random() * 7,
    type = Math.floor(Math.random() * planetColors.length),
    roughness = Math.random() > .6 ? 1 : 0,
    planetGeom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, roughness),
      new THREE.MeshLambertMaterial({
        color: planetColors[type],
        shading: THREE.FlatShading
      })
    ),
    planet = new THREE.Object3D();

  planet.add(planetGeom);

  if (type > 1 && Math.random() > 0.5) {
    var atmoGeom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size + 1.5, roughness),
      new THREE.MeshLambertMaterial({
        color: planetColors[3],
        shading: THREE.FlatShading,
        transparent: true,
        opacity: 0.5
      })
    );

    atmoGeom.castShadow = false;
    planet.add(atmoGeom);
  }

  planet.orbitRadius = Math.random() * 50 + 50 + radii;
  planet.rotSpeed = 0.005 + Math.random() * 0.01;
  planet.rotSpeed *= Math.random() < .10 ? -1 : 1;
  planet.rot = Math.random();
  planet.orbitSpeed = (0.02 - p * 0.0048) * 0.25;
  planet.orbit = Math.random() * Math.PI * 2;
  planet.position.set(planet.orbitRadius, 0, 0);

  radii = planet.orbitRadius + size;
  planets.push(planet);
  scene.add(planet);

  var orbit = new THREE.Line(
    new THREE.CircleGeometry(planet.orbitRadius, 90),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: .05,
      side: THREE.BackSide
    })
  );
  orbit.geometry.vertices.shift();
  orbit.rotation.x = THREE.Math.degToRad(90);
  scene.add(orbit);
}

//Lights
var light1 = new THREE.PointLight(starColor, 2, 0, 0);

light1.position.set(0, 0, 0);
scene.add(light1);

var light2 = new THREE.AmbientLight(0x090909);
scene.add(light2);

//2D
var bgStars = [];

for (var i = 0; i < 500; i++) {
  var tw = {
    x: Math.random(),
    y: Math.random()
  }

  bgStars.push(tw);
}

//Stat tracking
var stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';

document.body.appendChild(stats.domElement);

//Main Loop
var t = 0;
function animate() {
  stats.begin();

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';

  for (var s in bgStars) {
    var q = bgStars[s],
      oX = q.x * ctx.canvas.width,
      oY = q.y * ctx.canvas.height,
      size = Math.random() < .9998 ? Math.random() : Math.random() * 3;

    ctx.beginPath();
    ctx.moveTo(oX, oY - size);
    ctx.lineTo(oX + size, oY);
    ctx.lineTo(oX, oY + size);
    ctx.lineTo(oX - size, oY);
    ctx.closePath();
    ctx.fill();
  }

  for (var p in planets) {
    var planet = planets[p];
    planet.rot += planet.rotSpeed
    planet.rotation.set(0, planet.rot, 0);
    planet.orbit += planet.orbitSpeed;
    planet.position.set(Math.cos(planet.orbit) * planet.orbitRadius, 0, Math.sin(planet.orbit) * planet.orbitRadius);
  }
  t += 0.01;
  star.rotation.set(0, t, 0);
  for (var g in glows) {
    var glow = glows[g];
    glow.scale.set(
      Math.max(glow.origScale.x - .2, Math.min(glow.origScale.x + .2, glow.scale.x + (Math.random() > .5 ? 0.005 : -0.005))),
      Math.max(glow.origScale.y - .2, Math.min(glow.origScale.y + .2, glow.scale.y + (Math.random() > .5 ? 0.005 : -0.005))),
      Math.max(glow.origScale.z - .2, Math.min(glow.origScale.z + .2, glow.scale.z + (Math.random() > .5 ? 0.005 : -0.005)))
    );
    glow.rotation.set(0, t, 0);
  }

  renderer.render(scene, camera);

  stats.end();

  requestAnimationFrame(animate);
}
animate();