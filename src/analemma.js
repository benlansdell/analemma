import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { PointerLockControls } from 'PointerLockControls';
import { CSS2DRenderer, CSS2DObject } from 'CSS2DRenderer';
import { GUI } from 'GUI';

let gui;
let camera, scene, renderer, labelRenderer, controls;
let perihelionLabel, aphelionLabel, analemma;
let vernalEqLabel, summerSolsLabel, autumnalEqLabel, winterSolsLabel;
let anomaly, meanAnomaly;
let trails = [];
let earth, sun, current_object, current_view;
let earth_frame, mean_sun, mean_sun_orb, sphere_sun_orb;

let winter_solstice_orb, summer_solstice_orb, autumn_orb, vernal_orb;
let apparent_sun;
let solstices_etc;

const sunCamOffset = 20;
const sunDist = 90;
const SUN_RADIUS = 3;
const EARTH_RADIUS = 1;
let analemma_resolution = 10;

let eot_old = 0;
let solar_day_old;

const add_helpers = false;

const planets = {
    mercury: { eccentricity: 0.2056, obliquity: 0.034, siderealYear: 87.968, precession: -89+77, north_ra: 281, north_dec: 61.4},
    earth: { eccentricity: 0.0167, obliquity: 23.4, siderealYear: 365.2422, precession: 180-103, north_ra: 0, north_dec: 90.0},
    mars: { eccentricity: 0.0934, obliquity: 25.19, siderealYear: 686.98, precession: 180-70+336, north_ra: 317.7, north_dec: 52.9},
    jupiter: { eccentricity: 0.0489, obliquity: 3.13, siderealYear: 4332.6, precession: 57+14, north_ra: 268.1, north_dec: 64.5},
    saturn: { eccentricity: 0.052, obliquity: 26.73, siderealYear: 10759.2, precession: 2+92, north_ra: 40.6, north_dec: 83.5},
    neptune: { eccentricity: 0.008678, obliquity: 28.3, siderealYear: 60195, precession: 10+44, north_ra: 299.3, north_dec: 43.4}
}

//Sidereal year here is measure in that planet's mean solar days...
// const planets = {
//     mercury: { eccentricity: 0.2056, obliquity: 0.034, siderealYear: 87.968, precession: 180-89+77, north_ra: 281, north_dec: 61.4},
//     earth: { eccentricity: 0.0167, obliquity: 23.4, siderealYear: 365.2422, precession: 180-103, north_ra: 0, north_dec: 90.0},
//     mars: { eccentricity: 0.0934, obliquity: 25.19, siderealYear: 686.98, precession: 180-70+336, north_ra: 317.7, north_dec: 52.9},
//     jupiter: { eccentricity: 0.0489, obliquity: 3.13, siderealYear: 4332.6, precession: 180+57+14, north_ra: 268.1, north_dec: 64.5},
//     saturn: { eccentricity: 0.052, obliquity: 26.73, siderealYear: 10759.2, precession: 2+92, north_ra: 40.6, north_dec: 83.5},
//     neptune: { eccentricity: 0.008678, obliquity: 28.3, siderealYear: 60195, precession: 180+10+44, north_ra: 299.3, north_dec: 43.4}
// }
//uranus: { eccentricity: 0.04717, obliquity: 97.77, siderealYear: 30688.5},
//pluto: { eccentricity: 0.2488, obliquity: 122.53, siderealYear: 90560},
//venus: { eccentricity: 0.00677, obliquity: 2.64, siderealYear: 224.7},

//These values look pretty close to what other sources says I should expect. I just guessed the values though. 
//Above is our attempt at computing values
// const planets = {
//     mercury: { eccentricity: 0.2056, obliquity: 0.034, siderealYear: 87.968, precession: 180-77, north_ra: 0, north_dec: 0},
//     earth: { eccentricity: 0.0167, obliquity: 23.4, siderealYear: 365.2422, precession: 180-103, north_ra: 0, north_dec: 0},
//     mars: { eccentricity: 0.0934, obliquity: 25.19, siderealYear: 686.98, precession: 180-66, north_ra: 317.7, north_dec: 52.9},
//     jupiter: { eccentricity: 0.0489, obliquity: 3.13, siderealYear: 4332.6, precession: 180-96, north_ra: 0, north_dec: 0},
//     saturn: { eccentricity: 0.052, obliquity: 26.73, siderealYear: 10759.2, precession: 180-92, north_ra: 0, north_dec: 0},
//     neptune: { eccentricity: 0.008678, obliquity: 28.3, siderealYear: 60195, precession: 180-44, north_ra: 0, north_dec: 0}
// }

var elapsedTime = 0;

const earthsTilt = planets['earth']['obliquity']/180*Math.PI;
var siderealYear = planets['earth']['siderealYear'];

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
const container = document.querySelector('#scene-container');
const text = document.querySelector('#info');
const direction = new THREE.Vector3();
const delEarthFrame = new THREE.Vector3();
const sundirection = new THREE.Vector3();

//GUI settings
var params = {
    clockRate: 1,
    eccentricity: planets['earth']['eccentricity'],
    fix_view: false,
    view: "planet above",
    obliquity: planets['earth']['obliquity'],
    isPaused: false,
    preset: "earth",
    precession: planets['earth']['precession'],
}

function update_presets(value) {
    if (value in planets & value != 'custom') {
       params['obliquity'] = planets[value]['obliquity'];
       params['eccentricity'] = planets[value]['eccentricity'];        
       params['precession'] = planets[value]['precession'];        
       solsticesEquinoxes();
       updateKeplerOrbit(scene);
       updateEarthPlane(scene);
       updateAnalemma();
    }
}

function compute_other_precessions(planet, ra, dec) {

    const ra_r = ra/Math.PI*180;
    const dec_r = dec/Math.PI*180;
    const p_x = Math.cos(ra_r)*Math.cos(dec_r);
    const p_y = Math.sin(dec_r);
    const p_z = Math.cos(dec_r)*Math.sin(ra_r);
    var vec = earth_frame.localToWorld(new THREE.Vector3(p_x, p_y, p_z));
    vec.subVectors(earth_frame.position, vec);
    const prec = Math.atan2(vec.z, vec.x)*180/Math.PI;
    //const prec = Math.atan2(vec.x, vec.z)*180/Math.PI;
    //console.log(planet, 'precession is ' + prec)
}

function update_view(value) {
    if (value == 'planet above') {
        current_view = 'earth'; 
        current_object = earth;
        
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200000);
        //camera.up.set(0, Math.cos(params['obliquity']), Math.sin(params['obliquity'])); 
        camera.position.copy( prevCamera.position );
        camera.rotation.copy( prevCamera.rotation );
        controls = new OrbitControls(camera, labelRenderer.domElement);

    } else if (value == 'sun') {
        current_view = 'sun'; camera.up.set(0, 1, 0); current_object = sun;

        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200000);
        camera.position.copy( prevCamera.position );
        camera.rotation.copy( prevCamera.rotation );
        camera.lookAt( camera.position.x + 1, camera.position.y, camera.position.z )
        controls = new OrbitControls(camera, labelRenderer.domElement);

    } else if (value == 'planet surface') {
        current_view = 'surface'; current_object = earth;
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200000);
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
    } else if (value == 'planet center') {
        current_view = 'center'; current_object = earth;
        var prevCamera = camera;
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200000);
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

function winter_sols_pos() {
    return keplerDynamics(solstices_etc['wintersol'][0])
}

function summer_sols_pos() {
    return keplerDynamics(solstices_etc['summersol'][0])
}

function vernal_eq_pos() {
    return keplerDynamics(solstices_etc['vernaleq'][0])
}

function autumn_eq_pos() {
    return keplerDynamics(solstices_etc['autumneq'][0])
}

function newtonsMethod(x, f, df, N) {
    for (var i = 0; i < N; i++) {
        x = x - f(x) / df(x);
    }
    return x;
}

function mean_from_true(ta) {

    var ecc_an = 2*(Math.atan(Math.tan(ta/2)*Math.sqrt((1-params['eccentricity'] )/(1+params['eccentricity'] ))));
    var ma = ecc_an - params['eccentricity'] * Math.sin(ecc_an);
    const date = new Date(2023, 0, 4-ma*siderealYear/2/Math.PI);
    const date_str = date.toLocaleDateString('en-EN', {month: 'numeric', day: 'numeric'}); 
    return [ma, date_str];

}

function solsticesEquinoxes() {

    var ta_w = Math.PI/2-params['precession']/180*Math.PI;
    var ta_v = -params['precession']/180*Math.PI;

    var ta_s = 3*Math.PI/2-params['precession']/180*Math.PI;
    var ta_a = Math.PI-params['precession']/180*Math.PI;

    solstices_etc = {
        vernaleq: mean_from_true(ta_v),
        autumneq: mean_from_true(ta_a),
        wintersol: mean_from_true(ta_w),
        summersol: mean_from_true(ta_s)
    }
}

function keplerDynamics(meanAnomaly) {
    var eccAnomaly = newtonsMethod(meanAnomaly, (x) => (meanAnomaly - x + params['eccentricity'] * Math.sin(x)), (x) => (-1 + params['eccentricity'] * Math.cos(x)), 4);
    var trueAnomaly = 2 * Math.atan(Math.sqrt((1 + params['eccentricity']) / (1 - params['eccentricity'])) * Math.tan(eccAnomaly / 2));
    var r = sunDist * (1 - params['eccentricity'] * Math.cos(eccAnomaly));
    var x = r * Math.cos(trueAnomaly);
    var z = r * Math.sin(trueAnomaly);
    return [x, z]
}

function updateAnalemma() {

    let x, z, ma;
    trails = [];
    let ef = earth_frame, ms = mean_sun;
    let position_old = ef.position.clone();

    for (var i = 0; i < Math.round(366*analemma_resolution); i++) {
        ma = (2*Math.PI*i/siderealYear/analemma_resolution);//%(2*Math.PI);
        [x, z] = keplerDynamics(-ma);    

        ef.position.set(x, 0, z);
        ms.rotation.y = ma - params['precession']/180*Math.PI;
        ef.updateMatrixWorld();
        var localPtMeanSun = ms.worldToLocal(sun.position.clone()).normalize().multiplyScalar(5.0); //Transform the point from world space into the objects space
        trails.push(localPtMeanSun.clone());
    }

    const ana = scene.getObjectByName('analemma');
    var points = ana.geometry.attributes.position.array;
    for (var j = 0; j < trails.length; j++) {
        points[3 * j] = trails[j].x;
        points[3 * j + 1] = trails[j].y;
        points[3 * j + 2] = trails[j].z;
    }

    ana.geometry.attributes.position.needsUpdate = true;
    ana.geometry.computeBoundingSphere();

    ef.position.set(position_old.x, 0, position_old.z);
    ms.rotation.y = meanAnomaly - params['precession']/180*Math.PI;
    ef.updateMatrixWorld();

}


function dynamics() {

    var multiplier = params['clockRate'];
    if (current_view == 'surface') {
        multiplier *= 0.1;
    }
    let delta = clock.getDelta();

    if (params['isPaused'] == true) {return 0;}
    elapsedTime += delta*multiplier; //in days

    meanAnomaly = 2*Math.PI*elapsedTime/siderealYear;
    meanAnomaly %= Math.PI*2;
    let x, z;
    [x, z] = keplerDynamics(-meanAnomaly);
    earth_frame.position.set(x, 0, z);
    earth.rotation.y = 2*Math.PI*elapsedTime;
    mean_sun.rotation.y = meanAnomaly - params['precession']/180*Math.PI;

    //Convert it to earth frame
    earth_frame.updateMatrixWorld(); //Make sure the object matrix is current with the position/rotation/scaling of the object...
    var localPt = earth_frame.worldToLocal(sun.position.clone()).normalize().multiplyScalar(5); //Transform the point from world space into the objects space
    localPt.y = 0;

    anomaly = Math.atan2(localPt.z, -localPt.x);   
    if (anomaly < 0) { anomaly += 2*Math.PI }
    anomaly %= Math.PI*2;
    apparent_sun.rotation.y = anomaly;

    sundirection.subVectors(sun.position, earth_frame.position);
    sundirection.normalize().multiplyScalar(5);
    sundirection.add(earth_frame.position);
    sphere_sun_orb.position.set(sundirection.x, sundirection.y, sundirection.z);

    return 2*Math.PI*delta*multiplier/siderealYear; //in radians
}

function updateEarthPlane(scene) {
    earth_frame.rotation.y = params['precession']/180*Math.PI;
    earth_frame.rotation.x = params['obliquity']/180*Math.PI;
}

function updateKeplerOrbit(scene) {
    const orbit = scene.getObjectByName('earthorbit');
    var points = orbit.geometry.attributes.position.array;
    var ma = 0, x, z;
    for (var i = 0; i < 361; i++) {
        ma = i * Math.PI / 180;
        [x, z] = keplerDynamics(ma);
        points[3 * i] = x;
        points[3 * i + 1] = 0;
        points[3 * i + 2] = z;
    }

    orbit.geometry.attributes.position.needsUpdate = true;
    orbit.geometry.computeBoundingSphere();
}


function addKeplerOrbit(scene) {

    const points = [];
    var ma = 0, x, z;
    for (var i = 0; i < 361; i++) {
        ma = i * Math.PI / 180;
        [x, z] = keplerDynamics(ma);
        points.push(new THREE.Vector3(x, 0, z));
    }

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        linewidth: 1,
        opacity: 0.8,
        side: THREE.BackSide
    })

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbit = new THREE.Line(geometry, material);
    orbit.name = 'earthorbit';
    orbit.frustrumCulled = false;

    scene.add(orbit);

}

function addAnalemma() {

    for (var i = 0; i < 366*analemma_resolution; i++) {
        trails.push(new THREE.Vector3(i, 0, i));
    }

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: false,
        linewidth: 1,
        opacity: 1,
        side: THREE.BackSide
    })
    const geometry = new THREE.BufferGeometry().setFromPoints(trails);
    analemma = new THREE.Line(geometry, material);
    analemma.name = 'analemma';
    mean_sun.add(analemma);
}

function and_scene() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200000);
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

function add_marker_orbs() {

    const vernaleqpos = vernal_eq_pos();
    const autumnaleqpos = autumn_eq_pos();
    const summersolpos = summer_sols_pos();
    const wintersolpos = winter_sols_pos();
    const orb_size = .2;
    const orb_color = 0x009900;

    let geometry = new THREE.SphereGeometry(orb_size, 32, 32);
    let material = new THREE.MeshBasicMaterial({opacity : 1.0, transparent : false, color: orb_color});
    summer_solstice_orb = new THREE.Mesh(geometry, material);
    summer_solstice_orb.position.set(summersolpos[0], 0, summersolpos[1]);
    scene.add(summer_solstice_orb);

    geometry = new THREE.SphereGeometry(orb_size, 32, 32);
    material = new THREE.MeshBasicMaterial({opacity : 1.0, transparent : false, color: orb_color});
    winter_solstice_orb = new THREE.Mesh(geometry, material);
    winter_solstice_orb.position.set(wintersolpos[0], 0, wintersolpos[1]);
    scene.add(winter_solstice_orb);

    geometry = new THREE.SphereGeometry(orb_size, 32, 32);
    material = new THREE.MeshBasicMaterial({opacity : 1.0, transparent : false, color: orb_color});
    vernal_orb = new THREE.Mesh(geometry, material);
    vernal_orb.position.set(vernaleqpos[0], 0, vernaleqpos[1]);
    scene.add(vernal_orb);

    geometry = new THREE.SphereGeometry(orb_size, 32, 32);
    material = new THREE.MeshBasicMaterial({opacity : 1.0, transparent : false, color: orb_color});
    autumn_orb = new THREE.Mesh(geometry, material);
    autumn_orb.position.set(autumnaleqpos[0], 0, autumnaleqpos[1]);
    scene.add(autumn_orb);

}

function earth_location(scene) {

    let ef;
    const linematerial = new THREE.LineBasicMaterial( { color: 0x0000ff } );
    const linepoints = [];
    linepoints.push( new THREE.Vector3( 0, 0.1, 0 ) );
    linepoints.push( new THREE.Vector3( 0, 0, 0 ) );
    const linegeometry = new THREE.BufferGeometry().setFromPoints( linepoints );
    ef = new THREE.Line( linegeometry, linematerial );
    ef.eulerOrder = 'YXZ'; //Precess before adding obliquity
    ef.rotation.y = params['precession']/180*Math.PI;
    ef.rotation.x = earthsTilt;
    scene.add(ef);
    return ef;
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
    perihelionDiv.textContent = 'Perihelion 1/04';
    perihelionDiv.style.marginTop = '-2em';
    perihelionLabel = new CSS2DObject(perihelionDiv);
    perihelionLabel.position.set(0, 0, 0);
    scene.add(perihelionLabel);
    perihelionLabel.layers.set(0);

    const aphelionDiv = document.createElement('div');
    aphelionDiv.className = 'label';
    aphelionDiv.textContent = 'Aphelion 7/06';
    aphelionDiv.style.marginTop = '-2em';
    aphelionLabel = new CSS2DObject(aphelionDiv);
    aphelionLabel.position.set(-aphelion_x(), 0, 0);
    scene.add(aphelionLabel);

    /// Solstices and equinoxes
    const vernalEqDiv = document.createElement('div');
    const vernaleqpos = vernal_eq_pos();
    vernalEqDiv.className = 'label';
    vernalEqDiv.textContent = 'Vernal equinox ' + solstices_etc['vernaleq'][1];
    vernalEqDiv.style.marginTop = '-2em';
    vernalEqLabel = new CSS2DObject(vernalEqDiv);
    vernalEqLabel.position.set(vernaleqpos[0], 0, vernaleqpos[1]);
    scene.add(vernalEqLabel);
    vernalEqLabel.layers.set(0);

    const summerSolsDiv = document.createElement('div');
    const sumarsolpos = summer_sols_pos();
    summerSolsDiv.className = 'label';
    summerSolsDiv.textContent = 'Summer solstice ' + solstices_etc['summersol'][1];
    summerSolsDiv.style.marginTop = '-2em';
    summerSolsLabel = new CSS2DObject(summerSolsDiv);
    summerSolsLabel.position.set(sumarsolpos[0], 0, sumarsolpos[1]);
    scene.add(summerSolsLabel);

    const autumnalEqDiv = document.createElement('div');
    const autumneqpos = autumn_eq_pos();
    autumnalEqDiv.className = 'label';
    autumnalEqDiv.textContent = 'Autumnal equinox ' + solstices_etc['autumneq'][1];
    autumnalEqDiv.style.marginTop = '-2em';
    autumnalEqLabel = new CSS2DObject(autumnalEqDiv);
    autumnalEqLabel.position.set(autumneqpos[0], 0, autumneqpos[1]);
    scene.add(autumnalEqLabel);
    autumnalEqLabel.layers.set(0);

    const winterSolsDiv = document.createElement('div');
    const wintersolpos = winter_sols_pos();
    winterSolsDiv.className = 'label';
    winterSolsDiv.textContent = 'Winter Solstice ' + solstices_etc['wintersol'][1];
    winterSolsDiv.style.marginTop = '-2em';
    winterSolsLabel = new CSS2DObject(winterSolsDiv);
    winterSolsLabel.position.set(wintersolpos[0], 0, wintersolpos[1]);
    scene.add(winterSolsLabel);
}

function init() {

    scene = and_scene();
    earth_frame = earth_location(scene);
    earth = planet_earth(scene);
    sun = planet_sun(scene);
    add_mean_sun(scene);
    add_sun_celestial_sphere(scene);
    addKeplerOrbit(scene);
    addAnalemma();
    updateAnalemma();
    the_stars(scene);
    solsticesEquinoxes();
    text_setup(scene);
    add_marker_orbs();

    const light = new THREE.AmbientLight( 0x303030 ); // soft white light
    scene.add( light );

    current_object = earth;
    current_view = 'earth';

    if (add_helpers == true) {
        const axesHelper = new THREE.AxesHelper( 5 );
        earth_frame.add(axesHelper)
    }

    earth.layers.enableAll();

    renderer = new THREE.WebGLRenderer({'antialias': true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.append(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
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
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    //controls.handleResize();
}


function update_label_pos() {
    if (elapsedTime > .01) {
        perihelionLabel.position.set(perihelion_x(),0,0);
        aphelionLabel.position.set(-aphelion_x(),0,0);

        const vernaleqpos = vernal_eq_pos();
        vernalEqLabel.position.set(vernaleqpos[0], 0, vernaleqpos[1]);
    
        const sumarsolpos = summer_sols_pos();
        summerSolsLabel.position.set(sumarsolpos[0], 0, sumarsolpos[1]);
    
        const autumneqpos = autumn_eq_pos();
        autumnalEqLabel.position.set(autumneqpos[0], 0, autumneqpos[1]);
    
        const wintersolpos = winter_sols_pos();
        winterSolsLabel.position.set(wintersolpos[0], 0, wintersolpos[1]);

        vernal_orb.position.set(vernaleqpos[0], 0, vernaleqpos[1]);    
        summer_solstice_orb.position.set(sumarsolpos[0], 0, sumarsolpos[1]);
        autumn_orb.position.set(autumneqpos[0], 0, autumneqpos[1]);
        winter_solstice_orb.position.set(wintersolpos[0], 0, wintersolpos[1]);

        if (params['preset'] == 'earth' || params['preset'] == 'custom') {
        vernalEqLabel.element.innerHTML = 'Vernal equinox ' + solstices_etc['vernaleq'][1];
        summerSolsLabel.element.innerHTML = 'Summer solstice ' + solstices_etc['summersol'][1];
        autumnalEqLabel.element.innerHTML = 'Autumnal equinox ' + solstices_etc['autumneq'][1];  
        winterSolsLabel.element.innerHTML = 'Winter Solstice ' + solstices_etc['wintersol'][1];
        } else {
            vernalEqLabel.element.innerHTML = 'Vernal equinox';
            summerSolsLabel.element.innerHTML = 'Summer solstice';
            autumnalEqLabel.element.innerHTML = 'Autumnal equinox';  
            winterSolsLabel.element.innerHTML = 'Winter Solstice';
   
        }

    }
}

function animate() {
    requestAnimationFrame(animate);
    let old_earth_pos = earth_frame.position.clone();
    let delta = dynamics();

    compute_other_precessions('mercury', planets['mercury']['north_ra'], planets['mercury']['north_dec']);
    compute_other_precessions('mars', planets['mars']['north_ra'], planets['mars']['north_dec']);
    compute_other_precessions('jupiter', planets['jupiter']['north_ra'], planets['jupiter']['north_dec']);
    compute_other_precessions('saturn', planets['saturn']['north_ra'], planets['saturn']['north_dec']);
    compute_other_precessions('neptune', planets['neptune']['north_ra'], planets['neptune']['north_dec']);

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
    updateText(delta);
}

const formatTime = (seconds)=>{
    var flag = '';
    if (seconds < 0) {
        seconds *= -1;
        flag = ' behind'
    }
    const hours = Math.floor(seconds/60/60)
    const minutes = Math.floor((seconds - hours*60*60)/60)
    const secs = (seconds - minutes*60 - hours*60*60).toFixed(2);
    const dd = [hours, minutes, secs].map((a)=>(a < 10 ? '0' + a : a));
    return dd.join(':') + flag;
};

const formatSolarTime = (seconds)=>{
    const hours = Math.floor(seconds/60/60)
    const minutes = Math.floor((seconds - hours*60*60)/60)
    const secs = (seconds - minutes*60 - hours*60*60).toFixed(2);
    const dd = [hours, minutes, secs].map((a)=>(a < 10 ? '0' + a : a));
    return dd.join(':');
};

function updateText(delta) {
    //perihelion is on Jan 4th, 2023. So offset 4 days
    const date = new Date(2023, 0, 4+elapsedTime);
    const date_str = date.toLocaleDateString('en-EN', {month: 'numeric', day: 'numeric'}); 
    var ma = meanAnomaly - params['precession']/180*Math.PI;
    if (ma < 0) {
        ma += 2*Math.PI;
    }
    var eot = ((anomaly - ma)*180/Math.PI/15)*60*60; //in seconds
    if (eot < 0) {
        const eot_alt = ((2*Math.PI + anomaly - ma)*180/Math.PI/15)*60*60;
        if (Math.abs(eot_alt) < Math.abs(eot)) {
            eot = eot_alt;
        }
    }

    const delta_seconds = delta/2/Math.PI*siderealYear*(24*60*60); //elapsed time in seconds
    var diff_eot = (eot - eot_old)/delta_seconds; //change in eot/ per second
    diff_eot *= 24*60*60; //now measure in seconds per day

    if (params['isPaused'] == true) {
        var solar_day = solar_day_old;
    } else {
        var solar_day = 24*60*60 + diff_eot;
        solar_day_old = solar_day;
    }
    var eot_str = formatTime(eot);
    text.innerHTML = "Date: " + date_str + "<br>Equation of time: " + eot_str + "<br>Mean solar day: &nbsp;&nbsp;24:00:00.00<br>Solar day: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + formatSolarTime(solar_day);

    eot_old = eot;
}

function render() {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function initGui(scene) {
    gui = new GUI();
    gui.add(params, 'isPaused').name('pause')
    gui.add(params, 'clockRate', 0.1, 100, 5).name('clock rate')
    gui.add(params, 'preset', ["mercury","earth", "mars", "jupiter", "saturn", "neptune", "custom"]).name('setup for').onChange(update_presets);
    gui.add(params, 'eccentricity', 0.0, 0.95, 0.01).listen().onChange(function (value) {
            solsticesEquinoxes();
            updateAnalemma();
            updateKeplerOrbit(scene); gui.children[2].setValue('custom');
        }
    );
    gui.add(params, 'obliquity', 0.0, 90, 0.5).listen().onChange(function (value) {
        updateAnalemma();
        updateEarthPlane(scene); gui.children[2].setValue('custom');
    });
    gui.add(params, 'precession', 0.0, 360, 0.5).listen().onChange(function (value) {
        solsticesEquinoxes();
        updateAnalemma();
        updateEarthPlane(scene); gui.children[2].setValue('custom');
    });
    //gui.add(params, 'view', ["planet above", "planet surface", "planet center", "sun"]).name('viewpoint').onChange(update_view);
    gui.add(params, 'view', ["planet above", "sun"]).name('viewpoint').onChange(update_view);
    gui.add(params, 'fix_view').name('fix view').onChange(function (value) {controls.enabled = !value;})
    gui.open();
}

init();
animate();