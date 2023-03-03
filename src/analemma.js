import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { PointerLockControls } from 'PointerLockControls';
import { CSS2DRenderer, CSS2DObject } from 'CSS2DRenderer';
import { GUI } from 'GUI';

let gui;
let camera, scene, renderer, labelRenderer, controls;
let perihelionLabel, aphelionLabel, analemma;
let anomaly, meanAnomaly;
let trails = [];
let earth, sun, current_object, current_view;
let earth_frame, mean_sun, mean_sun_orb, sphere_sun_orb;
let apparent_sun;

const max_trail_len = 1000;
const sunCamOffset = 20;
const sunDist = 90;
const SUN_RADIUS = 3;
const EARTH_RADIUS = 1;

const planets = {
    mercury: { eccentricity: 0.2056, obliquity: 0.034, siderealYear: 87.968},
    venus: { eccentricity: 0.00677, obliquity: 2.64, siderealYear: 224.7},
    earth: { eccentricity: 0.0167, obliquity: 23.4, siderealYear: 365.2422},
    mars: { eccentricity: 0.0934, obliquity: 25.19, siderealYear: 686.98},
    jupiter: { eccentricity: 0.0489, obliquity: 3.13, siderealYear: 4332.6},
    saturn: { eccentricity: 0.0565, obliquity: 26.73, siderealYear: 10759.2},
    uranus: { eccentricity: 0.04717, obliquity: 97.77, siderealYear: 30688.5},
    neptune: { eccentricity: 0.008678, obliquity: 28.3, siderealYear: 60195},
    pluto: { eccentricity: 0.2488, obliquity: 122.53, siderealYear: 90560},
}

let last_updated_day = 0;
var elapsedTime = 0;

const earthsTilt = planets['earth']['obliquity']/180*Math.PI;
var siderealYear = planets['earth']['siderealYear'];

const analemma_update_rate = 2; //Measured in days

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
const container = document.querySelector('#scene-container');
const text = document.querySelector('#info');
const direction = new THREE.Vector3();
const delEarthFrame = new THREE.Vector3();
const sundirection = new THREE.Vector3();

//Controls settings
var params = {
    clockRate: 1,
    eccentricity: 0.0167,
    fix_view: false,
    draw_trails: true,
    view: "earth",
    obliquity: 23.4,
    isPaused: false,
    preset: "earth"
}

function update_presets(value) {
    if (value in planets & value != 'custom') {
       params['obliquity'] = planets[value]['obliquity'];
       params['eccentricity'] = planets[value]['eccentricity'];        
        siderealYear = planets[value]['siderealYear']
       updateKeplerOrbit(scene);
       updateEarthPlane(scene);
    }
}

function update_view(value) {
    if (value == 'earth above') {
        current_view = 'earth'; 
        current_object = earth;
        
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientWidth, 0.1, 200000);
        camera.up.set(0, Math.cos(earthsTilt), Math.sin(earthsTilt)); 
        camera.position.copy( prevCamera.position );
        camera.rotation.copy( prevCamera.rotation );
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
        camera.up.set(0, 1, 0);

        controls = new PointerLockControls( camera, labelRenderer.domElement );
        controls.lock();
        controls.movementSpeed = 100;
        controls.lookSpeed = .2;

        container.addEventListener( 'click', function () {
            controls.lock();
        } );
    } else if (value == 'earth center') {
        current_view = 'center'; current_object = earth;
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientWidth, 0.1, 200000);
        camera.position.set( 0,0,0 );
        camera.rotation.copy( prevCamera.rotation );
        earth_frame.add(camera);
        camera.up.set(0, 1, 0);
        //camera.lookAt( mean_sun.position );
        controls = new PointerLockControls( camera, labelRenderer.domElement );
        controls.lock();
        controls.movementSpeed = 100;
        controls.lookSpeed = .2;

        container.addEventListener( 'click', function () {
            controls.lock();
        } );
    }
}

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

function dynamics() {

    var multiplier = params['clockRate'];
    if (current_view == 'surface') {
        multiplier *= 0.1;
    }
    let delta = clock.getDelta();

    if (params['isPaused'] == true) {return 0;}
    elapsedTime += delta*multiplier;

    const day = Math.round(elapsedTime);

    meanAnomaly = 2*Math.PI*elapsedTime/siderealYear;
    meanAnomaly %= Math.PI*2;
    let x, z;
    [x, z] = keplerDynamics(-meanAnomaly);
    earth_frame.position.set(x, 0, z);
    earth.rotation.y = 2*Math.PI*elapsedTime;
    mean_sun.rotation.y = meanAnomaly;

    //Convert it to earth frame
    earth_frame.updateMatrixWorld(); //Make sure the object matrix is current with the position/rotation/scaling of the object...
    var localPt = earth_frame.worldToLocal(sun.position.clone()).normalize().multiplyScalar(5); //Transform the point from world space into the objects space
    if ((day % analemma_update_rate == 0) & (last_updated_day != day)) {
        var localPtMeanSun = mean_sun.worldToLocal(sun.position.clone()).normalize().multiplyScalar(5.0); //Transform the point from world space into the objects space
        last_updated_day = day;
        updateTrails(localPtMeanSun.clone());
    }
    localPt.y = 0;

    anomaly = Math.atan2(localPt.z, -localPt.x);   
    if (anomaly < 0) { anomaly += 2*Math.PI }
    anomaly %= Math.PI*2;
    apparent_sun.rotation.y = anomaly;

    sundirection.subVectors(sun.position, earth_frame.position);
    sundirection.normalize().multiplyScalar(5);
    sundirection.add(earth_frame.position);
    sphere_sun_orb.position.set(sundirection.x, sundirection.y, sundirection.z);

    return 2*Math.PI*delta*multiplier/siderealYear;
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

function updateTrails(coord) {

    //Update trails list
    trails.push(coord)
    trails.shift();

    const ana = scene.getObjectByName('analemma');
    var points = ana.geometry.attributes.position.array;
    for (var i = 0; i < trails.length; i++) {
        meanAnomaly = i * Math.PI / 180;
        points[3 * i] = trails[i].x;
        points[3 * i + 1] = trails[i].y;
        points[3 * i + 2] = trails[i].z;
    }

    ana.geometry.attributes.position.needsUpdate = true;
}

function addTrails(scene) {

    let x, z;
    for (var i = 0; i < Math.round(361/analemma_update_rate); i++) {
        trails.push(new THREE.Vector3(-5, 0, 0));
    }

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        linewidth: 20,
        opacity: 1,
        side: THREE.BackSide
    })
    const geometry = new THREE.BufferGeometry().setFromPoints(trails);
    analemma = new THREE.Line(geometry, material);
    analemma.name = 'analemma';
    mean_sun.add(analemma);
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

    //Celestial equator as a line
    const curve = new THREE.EllipseCurve( 0, 0, 5, 5); 
    const points = curve.getPoints( 50 ); 
    const geometry = new THREE.BufferGeometry().setFromPoints( points ); 
    const material = new THREE.LineBasicMaterial( { color: 0x0000ff } ); // Create the final object to add to the scene
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

    //mean sun orb
    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS/20, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({opacity : 1, transparent : true, color: 0x0000ff});
    mean_sun_orb = new THREE.Mesh(sunGeometry, sunMaterial);
    mean_sun_orb.position.set(-5, 0, 0);
    mean_sun.add(mean_sun_orb);
}

function add_sun_celestial_sphere(scene) {

    const curve = new THREE.EllipseCurve( 0, 0, 5, 5); 
    const points = curve.getPoints( 50 ); 
    const geometry = new THREE.BufferGeometry().setFromPoints( points ); 
    const material = new THREE.LineBasicMaterial( { color: 0xff0000 } ); // Create the final object to add to the scene
    apparent_sun = new THREE.Line( geometry, material );
    earth_frame.add(apparent_sun);

    const sunGeometry = new THREE.SphereGeometry(SUN_RADIUS/20, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({opacity : 1.0, transparent : true, color: 0xff0000});
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

function text_setup(scene) {

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

}

function init() {

    scene = and_scene();
    earth_location(scene);
    earth = planet_earth(scene);
    sun = planet_sun(scene);
    add_mean_sun(scene);
    add_sun_celestial_sphere(scene);
    addKeplerOrbit(scene);
    addTrails(scene);
    the_stars(scene);
    text_setup(scene);

    current_object = earth;
    current_view = 'earth';

    earth.layers.enableAll();

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.append(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    container.append(labelRenderer.domElement);

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


function update_label_pos() {
    if (elapsedTime > .01) {
        perihelionLabel.position.set(perihelion_x(),0,0);
        aphelionLabel.position.set(-aphelion_x(),0,0);
    }
}

function animate() {
    requestAnimationFrame(animate);
    let old_earth_pos = earth_frame.position.clone();
    let delta = dynamics();

    //What does this line do?
    if (current_view != 'surface' & current_view != 'center') {
        current_object.getWorldPosition(controls.target);
    }
    //Make camera point at the sun...
    if (params['fix_view'] == true & current_view == 'sun') {
        direction.subVectors(sun.position, earth_frame.position);
        direction.normalize().multiplyScalar(-sunCamOffset);
        const camera_pos = direction.add(earth_frame.position);   
        camera.position.x = camera_pos.x;
        camera.position.y = 5;
        camera.position.z = camera_pos.z;
    }
    else if (params['fix_view'] == true & current_view == 'earth') {
        direction.subVectors(sun.position, earth_frame.position);
        direction.normalize().multiplyScalar(sunCamOffset);
        const camera_pos = direction.add(earth_frame.position);   
        camera.position.x = camera_pos.x;
        camera.position.y = 5;
        camera.position.z = camera_pos.z;
    }
    else if (params['fix_view'] == true & current_view == 'surface') {
        camera.rotation.y -= delta;
    } //not fixed view, current view earth
    else if (params['fix_view'] == true & current_view == 'center') {
        camera.rotation.y -= delta;
    } //not fixed view, current view earth
    else if (params['fix_view'] == false & current_view == 'earth') {
        delEarthFrame.subVectors(earth_frame.position, old_earth_pos);
        camera.rotation.y -= delta;
        camera.position.x += delEarthFrame.x;
        camera.position.y += delEarthFrame.y;
        camera.position.z += delEarthFrame.z;
    }
    // if not fixed, sun view then use default OrbitControls

    update_label_pos();
    if (current_view != 'surface' & current_view != 'center') {
        controls.update();
    }
    render();
    updateText();
}

const formatTime = (seconds)=>{
    var flag = '';
    if (seconds < 0) {
        seconds *= -1;
        flag = ' before'
    }
    const hours = Math.floor(seconds/60/60)
    const minutes = Math.floor((seconds - hours*60*60)/60)
    const secs = Math.floor(seconds - minutes*60 - hours*60*60);
    const dd = [hours, minutes, secs].map((a)=>(a < 10 ? '0' + a : a));
    return dd.join(':') + flag;
};

function updateText() {
    //perihelion is on Jan 4th, 2023. So offset 4 days
    const date = new Date(2023, 0, 4+elapsedTime);
    const date_str = date.toLocaleDateString(); 
    const eot = ((anomaly - meanAnomaly)*180/Math.PI/24)*60*60; //in seconds
    var eot_str = formatTime(eot);
    text.innerHTML = date_str + "<br>Equation of time: " + eot_str;
}

function render() {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function initGui(scene) {
    gui = new GUI();
    gui.add(params, 'isPaused').name('pause')
    gui.add(params, 'clockRate', 0.1, 100, 5).name('clock rate')
    gui.add(params, 'preset', ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "custom"]).name('setup for').onChange(update_presets);
    gui.add(params, 'eccentricity', 0.0, 0.95, 0.1).listen().onChange(function (value) {
            updateKeplerOrbit(scene); gui.children[2].setValue('custom');
        }
    );
    gui.add(params, 'obliquity', 0.0, 180, 1).listen().onChange(function (value) {
        updateEarthPlane(scene); gui.children[2].setValue('custom');
    }
    );
    gui.add(params, 'view', ["earth above", "earth surface", "earth center", "sun"]).name('viewpoint').onChange(update_view);
    gui.add(params, 'fix_view').name('fix view').onChange(function (value) {controls.enabled = !value;})
    gui.add(params, 'draw_trails').name('draw trails')
    gui.open();
}

init();
animate();