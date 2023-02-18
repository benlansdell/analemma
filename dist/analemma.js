import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { PointerLockControls } from 'PointerLockControls';
import { CSS2DRenderer, CSS2DObject } from 'CSS2DRenderer';
import { GUI } from 'GUI';

let gui;

let camera, scene, renderer, labelRenderer, controls;
let perihelionLabel, aphelionLabel, earthLabel, moonLabel;

var params = {
    clockRate: 1,
    eccentricity: 0.0167,
    fix_view: false,
    view: "earth",
    obliquity: 23.4,
}

function update_view(value) {
    if (value == 'earth above') {
        current_view = 'earth above'; 
        current_object = earth;
        
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientWidth, 0.1, 200000);
        camera.up.set(0, Math.cos(earthsTilt), Math.sin(earthsTilt)); 
        camera.position.copy( prevCamera.position );
        camera.rotation.copy( prevCamera.rotation );
        //camera.lookAt( camera.position.x + 1, camera.position.y, camera.position.z )
        controls = new OrbitControls(camera, labelRenderer.domElement);

    } else if (value == 'sun') {
        current_view = 'sun'; camera.up.set(0, 1, 0); current_object = sun;

        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientWidth, 0.1, 200000);
        camera.position.copy( prevCamera.position );
        camera.rotation.copy( prevCamera.rotation );
        camera.lookAt( camera.position.x + 1, camera.position.y, camera.position.z )
        controls = new OrbitControls(camera, labelRenderer.domElement);

    } else if (value == 'earth surface') {
        current_view = 'surface'; current_object = earth;
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientWidth, 0.1, 200000);
        camera.position.set( 0,EARTH_RADIUS+.1,0 );
        camera.rotation.copy( prevCamera.rotation );
        earth_frame.add(camera);
        //camera.lookAt( earth.position );
        controls = new PointerLockControls( camera, labelRenderer.domElement );
        controls.lock();
        controls.movementSpeed = 100;
        controls.lookSpeed = .2;

        container.addEventListener( 'click', function () {
            controls.lock();
        } );
    }
}

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();

const container = document.querySelector('#scene-container');
const text = document.querySelector('#info');

const direction = new THREE.Vector3();
const sundirection = new THREE.Vector3();
const sunCamOffset = 120;
const camOffset = 50;

let moon, earth, sun, current_object, current_view, earth_frame, mean_sun, mean_sun_orb, sphere_sun_orb;
let apparent_sun;

//Measured in days
const moonSiderealMonth = 27.32;
const earthSiderealYear = 365.2422;

const sunDist = 90;
const moonDist = 2;

var earthsTilt = 23.5/180*Math.PI;

const SUN_RADIUS = 3;
const EARTH_RADIUS = 1;
const MOON_RADIUS = 0.27;

var elapsedTime = 0;

function perihelion_x() {
    return sunDist * (1 - params['eccentricity'])
}

function aphelion_x() {
    return sunDist * (1 + params['eccentricity'])
}

function newtonsMethod(x, f, df, N) {
    for (var i = 0; i < N; i++) {
        x = x - f(x) / df(x);
    }
    return x;
}

function keplerDynamics(meanAnomaly) {
    var eccAnomaly = newtonsMethod(meanAnomaly, (x) => (meanAnomaly - x + params['eccentricity'] * Math.sin(x)), (x) => (-1 + params['eccentricity'] * Math.cos(x)), 4);
    var trueAnomaly = 2 * Math.atan(Math.sqrt((1 + params['eccentricity']) / (1 - params['eccentricity'])) * Math.tan(eccAnomaly / 2));
    var r = sunDist * (1 - params['eccentricity'] * Math.cos(eccAnomaly));
    var x = r * Math.cos(trueAnomaly);
    var z = r * Math.sin(trueAnomaly);
    return [x, z]
}

function updateEarthPlane(scene) {
    earth_frame.rotation.x = params['obliquity']/180*Math.PI;
}

function updateKeplerOrbit(scene) {
    const orbit = scene.getObjectByName('earthorbit');
    var points = orbit.geometry.attributes.position.array;
    var meanAnomaly = 0, x, z;
    for (var i = 0; i < 361; i++) {
        meanAnomaly = i * Math.PI / 180;
        [x, z] = keplerDynamics(meanAnomaly);
        points[3 * i] = x;
        points[3 * i + 1] = 0;
        points[3 * i + 2] = z;
    }

    orbit.geometry.attributes.position.needsUpdate = true;
}

function addKeplerOrbit(scene) {

    const points = [];
    var meanAnomaly = 0, x, z;
    for (var i = 0; i < 361; i++) {
        meanAnomaly = i * Math.PI / 180;
        [x, z] = keplerDynamics(meanAnomaly);
        points.push(new THREE.Vector3(x, 0, z));
    }

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        linewidth: 2,
        opacity: 0.1,
        side: THREE.BackSide
    })

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbit = new THREE.Line(geometry, material);
    orbit.name = 'earthorbit';

    scene.add(orbit);

}

function and_scene() {
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientWidth, 0.1, 200000);
    camera.position.set(10, 5, 20);
    camera.layers.enableAll();
    camera.layers.toggle(1);

    scene = new THREE.Scene();

    const dirLight = new THREE.PointLight(0xffffff);
    dirLight.position.set(0, 0, 0);
    dirLight.layers.enableAll();

    scene.add(dirLight);
    return scene
}

function planet_earth(scene) {
    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
        specular: 0x333333,
        shininess: 5,
        map: textureLoader.load('textures/planets/earth_atmos_2048.jpg'),
        specularMap: textureLoader.load('textures/planets/earth_specular_2048.jpg'),
        normalMap: textureLoader.load('textures/planets/earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(0.85, 0.85)
    });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    
    earth.position.set(0,0,0);
    earth_frame.add(earth);

    //Ecliptic as a line
    const curve = new THREE.EllipseCurve( 0, 0, 5, 5); 
    const points = curve.getPoints( 50 ); 
    const geometry = new THREE.BufferGeometry().setFromPoints( points ); 
    const material = new THREE.LineBasicMaterial( { color: 0xff0000 } ); // Create the final object to add to the scene
    const ellipse = new THREE.Line( geometry, material );
    ellipse.rotation.x = THREE.Math.degToRad(90);
    earth.add(ellipse);

    const linematerial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
    const linepoints = [];
    linepoints.push( new THREE.Vector3( 0, 5, 0 ) );
    linepoints.push( new THREE.Vector3( 0, -5, 0 ) );
    
    const linegeometry = new THREE.BufferGeometry().setFromPoints( linepoints );
    const line = new THREE.Line( linegeometry, linematerial );
    earth.add(line);

    earth.layers.enableAll();

    return earth
}

function add_mean_sun(scene) {

    //Ecliptic as a line
    const curve = new THREE.EllipseCurve( 0, 0, 5, 5); 
    const points = curve.getPoints( 50 ); 
    const geometry = new THREE.BufferGeometry().setFromPoints( points ); 
    const material = new THREE.LineBasicMaterial( { color: 0xff0000 } ); // Create the final object to add to the scene
    mean_sun = new THREE.Line( geometry, material );
    earth_frame.add(mean_sun);

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS/10, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({opacity : 0.5, transparent : true});
    mean_sun_orb = new THREE.Mesh(sunGeometry, sunMaterial);
    mean_sun_orb.position.set(-5, 0, 0);
    mean_sun.add(mean_sun_orb);
}

function add_sun_celestial_sphere(scene) {

    //Take difference of 

    //Ecliptic as a line
    const curve = new THREE.EllipseCurve( 0, 0, 5, 5); 
    const points = curve.getPoints( 50 ); 
    const geometry = new THREE.BufferGeometry().setFromPoints( points ); 
    const material = new THREE.LineBasicMaterial( { color: 0xff0000 } ); // Create the final object to add to the scene
    apparent_sun = new THREE.Line( geometry, material );
    earth_frame.add(apparent_sun);

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS/10, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({opacity : 0.5, transparent : true});
    sphere_sun_orb = new THREE.Mesh(sunGeometry, sunMaterial);
    sphere_sun_orb.position.set(-5, 0, 0);
    scene.add(sphere_sun_orb);
}

function earth_location(scene) {

    const linematerial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
    const linepoints = [];
    linepoints.push( new THREE.Vector3( 0, 0.1, 0 ) );
    linepoints.push( new THREE.Vector3( 0, 0, 0 ) );
    const linegeometry = new THREE.BufferGeometry().setFromPoints( linepoints );
    earth_frame = new THREE.Line( linegeometry, linematerial );
    earth_frame.rotation.x = earthsTilt;
    scene.add(earth_frame);
    return earth_frame;
}

function planet_sun(scene) {
    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({});
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
    return sun
}

function the_moon(scene) {

    const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 32, 32);
    const moonMaterial = new THREE.MeshPhongMaterial({
        shininess: 5,
        map: textureLoader.load('textures/planets/moon_1024.jpg')
    });
    moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(0,0,0);
    moon.layers.enableAll();
    return moon
}

function the_stars(scene) {

    var MAX_POINTS = 10000;
    var POINTS_RANGE = 10000;
    var pc_geometry = new THREE.BufferGeometry();
    var pc_positions = new Float32Array(MAX_POINTS * 3);
    pc_geometry.setAttribute('position', new THREE.BufferAttribute(pc_positions, 3));

    var material = new THREE.PointsMaterial({
        color: 0xdddddd,
        size: 0.5,
        opacity: 1
    });

    function setPoints() {

        var positions = pointCloud.geometry.attributes.position.array;

        var x, y, z, currentPointsIndex = 0;

        for (var i = 0; i < MAX_POINTS; i++) {
            x = (Math.random() - 0.5) * POINTS_RANGE;
            y = (Math.random() - 0.5) * POINTS_RANGE;
            z = (Math.random() - 0.5) * POINTS_RANGE;
            positions[currentPointsIndex++] = x;
            positions[currentPointsIndex++] = y;
            positions[currentPointsIndex++] = z;
        }
        pointCloud.geometry.attributes.position.needsUpdate = true;
        pointCloud.geometry.setDrawRange(0, MAX_POINTS);

    }

    var pointCloud = new THREE.Points(pc_geometry, material);
    scene.add(pointCloud);

    setPoints();
}

function text_setup(scene, moon, earth) {

    // const dummyDiv = document.createElement('div');
    // dummyDiv.className = 'label';
    // dummyDiv.textContent = 'Perihelion';
    // dummyDiv.style.marginTop = '-1em';
    // const dummyLabel = new CSS2DObject(dummyDiv);
    // dummyLabel.position.set(-aphelion_x(), 0, 0);
    // scene.add(dummyLabel);
    // //perihelionLabel.layers.set(0);

    const perihelionDiv = document.createElement('div');
    perihelionDiv.className = 'label';
    perihelionDiv.textContent = 'Perihelion';
    perihelionDiv.style.marginTop = '-1em';
    perihelionLabel = new CSS2DObject(perihelionDiv);
    perihelionLabel.position.set(0, 0, 0);
    scene.add(perihelionLabel);
    perihelionLabel.layers.set(0);

    const aphelionDiv = document.createElement('div');
    aphelionDiv.className = 'label';
    aphelionDiv.textContent = 'Aphelion';
    aphelionDiv.style.marginTop = '-1em';
    aphelionLabel = new CSS2DObject(aphelionDiv);
    aphelionLabel.position.set(-aphelion_x(), 0, 0);
    scene.add(aphelionLabel);
    //aphelionLabel.layers.set(0);

    const earthDiv = document.createElement('div');
    earthDiv.className = 'label';
    earthDiv.textContent = 'Earth';
    earthDiv.style.marginTop = '-1em';
    earthLabel = new CSS2DObject(earthDiv);
    earthLabel.visible = true;
    earthLabel.renderOrder = Infinity;
    earthLabel.position.set(0, EARTH_RADIUS, 0);
    //earthLabel.position.set(0, 0, 0);
    scene.add(earthLabel);
    earthLabel.layers.set(0);

    const moonDiv = document.createElement('div');
    moonDiv.className = 'label';
    moonDiv.textContent = 'Moon';
    moonDiv.style.marginTop = '-1em';
    moonLabel = new CSS2DObject(moonDiv);
    moonLabel.position.set(0, MOON_RADIUS, 0);
    scene.add(moonLabel);
    //moonLabel.layers.set(0);

}

function init() {

    scene = and_scene();
    earth_location(scene);
    earth = planet_earth(scene);
    sun = planet_sun(scene);
    moon = the_moon(scene);
    add_mean_sun(scene);
    earth.add(moon);
    add_sun_celestial_sphere(scene);
    addKeplerOrbit(scene);
    the_stars(scene);
    text_setup(scene, moon, earth);

    current_object = earth;
    current_view = 'earth';

    earth.layers.enableAll();
    moon.layers.enableAll();

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.append(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    container.append(labelRenderer.domElement);

    // labelRenderer = new CSS2DRenderer();
    // labelRenderer.setSize(container.innerWidth, container.innerHeight);
    // labelRenderer.domElement.style.position = "absolute";
    // labelRenderer.domElement.style.top = "0px";
    // container.append(labelRenderer.domElement);

    //controls = new OrbitControls(camera, labelRenderer.domElement);
    controls = new OrbitControls(camera, labelRenderer.domElement);
    controls.minDistance = 5;
    controls.maxDistance = 500;

    window.addEventListener('resize', onWindowResize);

    initGui(scene);

}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    controls.handleResize();
}

function dynamics() {

    var multiplier = params['clockRate'];
    if (current_view == 'surface') {
        multiplier *= 0.1;
    }
    elapsedTime += clock.getDelta() * multiplier;

    var t = clock.getElapsedTime();
    var meanAnomaly = -2 * Math.PI * elapsedTime / earthSiderealYear;
    let x, z;
    [x, z] = keplerDynamics(meanAnomaly);
    earth_frame.position.set(x, 0, z);
    moon.position.set(Math.sin(2 * Math.PI * elapsedTime / moonSiderealMonth) * moonDist, 0, Math.cos(2 * Math.PI * elapsedTime / moonSiderealMonth) * moonDist);
    // if (params['fix_view'] == false) {
    //     camera.position.set( earth.position.x, earth.position.y, earth.position.z);
    // }
    earth.rotation.y = 2 * Math.PI * elapsedTime;
    mean_sun.rotation.y = -meanAnomaly;

    sundirection.subVectors(sun.position, earth_frame.position);
    sundirection.normalize().multiplyScalar(5);
    sundirection.add(earth_frame.position);
    sphere_sun_orb.position.set(sundirection.x, sundirection.y, sundirection.z);
}

function update_label_pos() {
    if (elapsedTime > .01) {
        perihelionLabel.position.set(perihelion_x(),0,0);
        aphelionLabel.position.set(-aphelion_x(),0,0);
        earthLabel.position.x = earth.position.x;
        earthLabel.position.y = earth.position.y;
        earthLabel.position.z = earth.position.z;
        moonLabel.position.x = moon.position.x;
        moonLabel.position.y = moon.position.y;
        moonLabel.position.z = moon.position.z;
    }
}

function animate() {
    requestAnimationFrame(animate);

    //What does this line do?
    if (current_view != 'surface') {
        current_object.getWorldPosition(controls.target);
    }
    //Make camera point at the sun...
    if (params['fix_view'] == true & current_view == 'sun') {
        direction.subVectors(earth.position, sun.position);
        direction.normalize().multiplyScalar(sunCamOffset);
        const camera_pos = direction.add(sun.position);
        camera.position.x = camera_pos.x;
        camera.position.z = camera_pos.z;
    }
    else if (params['fix_view'] == true & current_view == 'earth') {
        direction.subVectors(earth.position, sun.position);
        direction.normalize().multiplyScalar(camOffset);
        const camera_pos = direction.add(earth.position);
        camera.position.x = camera_pos.x;
        camera.position.z = camera_pos.z;
    } //not fixed view, current view earth
    else if (params['fix_view'] == false & current_view == 'earth') {
        camera.position.x = earth.position.x;
        camera.position.z = earth.position.z;
    }
    // if not fixed, sun view then use default OrbitControls

    dynamics();
    update_label_pos();
    if (current_view != 'surface') {
        controls.update();
    }
    render();
    //stats.update();
    updateText();
}

function updateText() {
    //perihelion is on Jan 4th, 2023. So offset 4 days
    const date = new Date(2023, 0, 4+elapsedTime);
    const date_str = date.toLocaleDateString()
    text.innerHTML = "What is the analemma?<br>" + date_str;
}

function render() {
    renderer.render(scene, camera);
    //labelRenderer.render(scene, camera);
}

function initGui(scene) {
    gui = new GUI();
    gui.add(params, 'clockRate', 0.1, 100, 5).name('clock rate')
    gui.add(params, 'eccentricity', 0.0, 0.95, 0.1).onChange(function (value) {
            updateKeplerOrbit(scene);
        }
    );
    gui.add(params, 'obliquity', 0.0, 90, 1).onChange(function (value) {
        updateEarthPlane(scene);
    }
    );
    gui.add(params, 'view', ["earth above", "earth surface", "sun"]).name('viewpoint').onChange(update_view);
    gui.add(params, 'fix_view').name('fix view').onChange(function (value) {controls.enabled = !value;})
    gui.open();
}

init();
animate();