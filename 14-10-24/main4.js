
let scene, camera, renderer, controls;
let model, layers = {}, cloud;
let material, isGray = true;
let isAnimating = false;
const slider_color = document.getElementById('colorSlider');
const slider_layer= document.getElementById('layerSlider');
const slider_cloud = document.getElementById('cloudPositionSlider');
const slider_tank = document.getElementById('tankSlider');
const slider_pipe = document.getElementById('pipeSlider');
const slider_soil = document.getElementById('soilSlider');
const slider_rain = document.getElementById('rainSlider');
const slider_averageSensor = document.getElementById('colorSlider'); 
const slider_weather = document.getElementById('cloudPositionSlider');

let directionalLight, temperatureText, font;
const clock = new THREE.Clock();

async function init() {
  let scene, camera, renderer, controls, pointLight, model;
  let lastSentTime = 0;
  const receivedData1 = Object.create(null);

  const socket = new WebSocket('ws://192.168.29.202:1880/ws/data');// wss://nodered.local/ws/data node-red url of the server it can be global or local
    
  const heartbeatInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, 30000);

  socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established');
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ ping: 1 }));
    }
  });
  socket.addEventListener('error', (error) => {
      console.error('WebSocket Error:', error);
      
  });
  socket.addEventListener('close', () => {
      clearInterval(heartbeatInterval);
      console.log('WebSocket connection closed');
  });

  const socket1 = new WebSocket('ws://192.168.29.202:1880/ws');// wss://nodered.local/ws node-red url of the server it can be global or local

  socket1.addEventListener('open', (event) => {
      console.log('WebSocket connection established');
  });

  socket1.addEventListener('close', () => {
    console.log('WebSocket connection closed');
  });

  socket1.addEventListener('message', (event) => {
    try {
        const result = JSON.parse(event.data);

        Object.keys(result).forEach(key => {
            receivedData1[key] = result[key];
        });

        if (receivedData1.clouds !== undefined) {
          const newSliderValue = receivedData1.clouds;
          slider_cloud.value = newSliderValue;
          const normalizedValue = receivedData1.clouds / 100; 
          updateCloudColor(normalizedValue);
          updateWeatherStatus(newSliderValue);  
        }

        if (receivedData1.layers !== undefined) {
          const newSliderValue = receivedData1.layers;
          slider_layer.value = newSliderValue;
          const normalizedValue = receivedData1.layers / 100;  
          updateLayerPositions(normalizedValue);  
        }

        if (receivedData1.soil !== undefined) {
          const newSliderValue = receivedData1.soil;
          slider_soil.value = newSliderValue;
          const normalizedValue = 1 - (receivedData1.soil / 100); 
          updateSoilOpacity(normalizedValue);  
          updateDashboard('soilTransparency', newSliderValue);
        }
        
        if (receivedData1.tank !== undefined) {
          const newSliderValue = receivedData1.tank;
          slider_tank.value = newSliderValue;
          const normalizedValue = 1 - (receivedData1.tank / 100);
          updateTankOpacity(normalizedValue); 
          updateDashboard('tankTransparency', newSliderValue);
        }

        if (receivedData1.temp !== undefined) {
          // Calculate the average temperature from the sensors
          const averageTemp = calculateAverageTemperature(receivedData1.temp);
          
          // Update the slider and color based on the average temperature
          const newSliderValue = averageTemp;
          slider_color.value = newSliderValue;
          const normalizedValue = newSliderValue / 100; 
          
          updateColorAndLight(normalizedValue);  // Update color and light with the average temperature
          updateAverageSensorReading(newSliderValue);  // Update average sensor reading (assuming you have this function)
      }

        if (receivedData1.pipe !== undefined) {
          const newSliderValue = receivedData1.pipe;
          slider_pipe.value = newSliderValue;
          const normalizedValue = 1 - (receivedData1.pipe / 100); 
          updatepipeOpacity(normalizedValue);
          updateDashboard('pipeTransparency', newSliderValue); 
        }

        if (receivedData1.rain !== undefined) {
          const newSliderValue = receivedData1.rain;
          slider_rain.value = newSliderValue;
          const normalizedValue = 1 - (receivedData1.rain / 100); 
          updatepipeOpacity(normalizedValue);
          updateRainStatus(newSliderValue);  
        }

        if (receivedData1.rainSpeed !== undefined) {
          rainSpeedFactor = parseFloat(receivedData1.rainSpeed);
          slider_rain.value = rainSpeedFactor;
        }
          
        console.log('Data received from Node-RED:', receivedData1);
       
    } catch (error) {
        console.error('Error parsing data from Node-RED:', error);
    }
  });

  function requestData() {
    if (socket1.readyState === WebSocket.OPEN) {
        socket1.send('getData');
    } else {
        console.log('WebSocket is not open. ReadyState:', socket1.readyState);
    }
  }

  function sendPing() {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ping: 1 }));
    }
  }

  function calculateAverageTemperature(tempData) {
    let totalTemp = 0;
    let count = 0;
    
    for (const key in tempData) {
        if (tempData.hasOwnProperty(key) && key.includes('sensor') && key.includes('temp')) {
            totalTemp += tempData[key];  // Add the temperature value
            count++;  // Count the number of temperatures
        }
    }

    return count > 0 ? totalTemp / count : 0;  // Return the average or 0 if no temps
  }
  function updateDashboard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = `${elementId.replace(/([A-Z])/g, ' $1')}: ${value}`;
    } else {
      console.warn(`Element with id "${elementId}" not found.`);
    }
  }

  // Function to toggle pump status
  function togglePump() {
    const pumpStatus = document.getElementById('pumpStatus');
    const pumpImage = document.getElementById('pumpImage');
    if (pumpStatus.textContent.includes('Off')) {
      updateDashboard('pumpStatus', 'On');
      if (pumpImage) pumpImage.src = 'images/On.png';
    } else {
      updateDashboard('pumpStatus', 'Off');
      if (pumpImage) pumpImage.src = 'images/Off.png';
    }
  }

  // Corrected the element ID to match the HTML
  document.getElementById('pumpButton').addEventListener('click', togglePump);

  // Function to update average roof temperature based on sensor reading slider
  function updateAverageSensorReading(value) {
    let temperature;
    let temperatureImageSrc;
    if (value <= 25) {
      temperature = "10°C";
      temperatureImageSrc = 'images/10°C.png';
    } else if (value > 25 && value <= 50) {
      temperature = "20°C";
      temperatureImageSrc = 'images/20°C.png';
    } else if (value > 50 && value <= 75) {
      temperature = "30°C";
      temperatureImageSrc = 'images/30°C.png';
    } else if (value > 75 && value <= 100) {
      temperature = "40°C";
      temperatureImageSrc = 'images/40°C.png';
    }
    updateDashboard('roofTemperature', temperature);
    const temperatureImage = document.getElementById('temperatureImage');
    if (temperatureImage) {
      temperatureImage.src = temperatureImageSrc;
    }
  }

  slider_averageSensor.addEventListener('input', (event) => {
    const value = parseInt(event.target.value, 10);
    updateAverageSensorReading(value);
  });

  // Function to update weather based on weather slider
  function updateWeatherStatus(value) {
    let weatherStatus;
    let weatherImageSrc;
    if (value >= 0 && value <= 5) {
      weatherStatus = 'Clear';
      weatherImageSrc = 'images/W_1_Clear.png';
    } else if (value > 5 && value <= 35) {
      weatherStatus = 'Slightly Cloudy';
      weatherImageSrc = 'images/W_2_slightly.png';
    } else if (value > 35 && value <= 75) {
      weatherStatus = 'Cloudy';
      weatherImageSrc = 'images/W_3_Moderately.png';
    } else if (value > 75 && value <= 100) {
      weatherStatus = 'Overcast';
      weatherImageSrc = 'images/W_4_Overcast.png';
    }
    updateDashboard('weatherStatus', weatherStatus);
    const weatherImage = document.getElementById('weatherImage');
    if (weatherImage) {
      weatherImage.src = weatherImageSrc;
    }
  }

  slider_weather.addEventListener('input', (event) => {
    const value = parseInt(event.target.value, 10);
    updateWeatherStatus(value);
  });

  // Function to update rain status based on rain slider
  function updateRainStatus(value) {
    let rainStatus;
    let rainImageSrc;
    if (value == 0) {
      rainStatus = 'None';
      rainImageSrc = 'images/rain_none.png';
    } else if (value > 0 && value <= 25) {
      rainStatus = 'Slight Rain';
      rainImageSrc = 'images/rain_slight.png';
    } else if (value > 25 && value <= 50) {
      rainStatus = 'Moderate Rain';
      rainImageSrc = 'images/rain_moderate.png';
    } else if (value > 50 && value <= 75) {
      rainStatus = 'Heavy Rain';
      rainImageSrc = 'images/rain_heavy.png';
    } else if (value > 75 && value <= 100) {
      rainStatus = 'Very Heavy Rain';
      rainImageSrc = 'images/rain_very_heavy.png';
    }
    updateDashboard('rainStatus', rainStatus);
    const rainImage = document.getElementById('rainImage');
    if (rainImage) {
      rainImage.src = rainImageSrc;
    }
  }

 // slider_rain.addEventListener('input', (event) => {
   // const value = parseInt(event.target.value, 10);
   // updateRainStatus(value);
    //rainSpeedFactor = parseFloat(value);
  //});
  
  let mixer = new THREE.AnimationMixer(model);
 

  function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(135 / 255, 206 / 255, 235 / 255);

    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(1, 2, 3);

    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xffffff); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    let animateRainFlag = false;
    document.getElementById('rainButton').addEventListener('click', () => {
        animateRainFlag = !animateRainFlag; 
    });

    let rainSpeedFactor = 50;  // Default rain speed factor (can be updated by slider or Node-RED)

    // Function to create rain
    function createRain(raindropMesh) {
      const rainCount = 1000;
      const rainGeometry = new THREE.BufferGeometry();
      const rainPositions = new Float32Array(rainCount * 3);
      const rainSpeeds = new Float32Array(rainCount);
      const dummy = new THREE.Object3D();
      const initialPositions = [];
    
      const instancedRain = new THREE.InstancedMesh(
        raindropMesh.geometry,
        raindropMesh.material,  
        rainCount                
      );
      
      for (let i = 0; i < rainCount; i++) {
        const x = (Math.random() * 40 - 20);  
        const y = 50;  
        const z = (Math.random() * 40 - 20);  
        rainSpeeds[i] = Math.random() * 0.1 + 0.05;
    
        initialPositions.push({ x, y, z });
        dummy.position.set(x, y, z);
        dummy.scale.set(0.2, 0.2, 0.2);
        dummy.updateMatrix();  
        instancedRain.setMatrixAt(i, dummy.matrix);      
      }
    
      scene.add(instancedRain);
      
    
      function updateRain() {
        if (animateRainFlag) {  
          animateRain(instancedRain, rainSpeeds, 50);
          instancedRain.visible = true; 
        } else {
          instancedRain.visible = false;
          for (let i = 0; i < instancedRain.count; i++) {
            const initialPos = initialPositions[i];
            dummy.position.set(initialPos.x, initialPos.y, initialPos.z);
            dummy.updateMatrix();
            instancedRain.setMatrixAt(i, dummy.matrix);
          }
          instancedRain.instanceMatrix.needsUpdate = true;
        }
        requestAnimationFrame(updateRain); 
      }
    
      updateRain();
    }
    
    // Function to animate rain
    function animateRain(instancedRain, rainSpeeds, cloudHeight) {
      const dummy = new THREE.Object3D();  
      
      function update() {
        for (let i = 0; i < instancedRain.count; i++) {
          instancedRain.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.rotation, dummy.scale);  
          
          // Update rain position based on rainSpeedFactor
          dummy.position.y -= rainSpeeds[i] * rainSpeedFactor * 0.1;
          
          if (dummy.position.y < cloudHeight - 50) {
            dummy.position.y = cloudHeight; 
          }
    
          dummy.updateMatrix();
          instancedRain.setMatrixAt(i, dummy.matrix);  
        }
        
        instancedRain.instanceMatrix.needsUpdate = true;  
      }
    
      update();
    }
    
    
// /home/variation2_11.glb
    const loader = new THREE.GLTFLoader();
    loader.load('/variation2_16.glb', (gltf) => {
        model = gltf.scene;
        scene.add(model);
    
        layers.layer1 = model.getObjectByName('PR_WP');
        layers.layer2 = model.getObjectByName('PR_DL');
        layers.layer3 = model.getObjectByName('PR_HC');
        layers.layer4 = model.getObjectByName('PR_MW');
        layers.layer5 = model.getObjectByName('PR_SOIL');
        layers.layer6 = model.getObjectByName('PR_Veg');
        const raindropMesh = gltf.scene.getObjectByName('Rain');
        //const cube = gltf.scene.getObjectByName('Rain1');
        createRain(raindropMesh);
        const soil=model.getObjectByName('Cube');
        tank = model.getObjectByName('tank');
        //tank.visible = false;
        soil.material.transparent = false;
        tank.traverse((child) => {
            if (child.isMesh) {
              child.material.transparent = true; 
              tank = child; 
            }
          });


          let objectToAnimate = model.getObjectByName('Cylinder_2');
          if (objectToAnimate) {
            material = new THREE.ShaderMaterial({
              uniforms: {
                u_minY: { value: -10.0 },  
                u_maxY: { value: 100.0 },   
                u_progress: { value: 0.0 } 
              },
              vertexShader: `
                varying float vY;
                void main() {
                  vY = position.y;  // Pass the Y position to the fragment shader
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
              uniform float u_minY;
              uniform float u_maxY;
              uniform float u_progress;
              varying float vY;
              void main() {
                // Normalize the Y position
                float t = (vY - u_minY) / (u_maxY - u_minY);

                // Reverse the colors: Start with gray, animate to blue
                vec3 blue = vec3(0.0, 0.5, 1.0); // Water blue color
                vec3 gray = vec3(0.5, 0.5, 0.5); // Gray color

                // Transition the color from gray to blue based on progress
                vec3 color = mix(blue, gray, smoothstep(0.0, u_progress, t));

                gl_FragColor = vec4(color, 1.0);
              }
            `
            });
           
            objectToAnimate.material = material;
          } else {
            console.error('Object not found!');
          }

          function changeObjectColor(progressValue) {
            if (objectToAnimate && material) {
                material.uniforms.u_progress.value = progressValue;
                isGray = progressValue === 0;  
            }
        }

          slider_rain.addEventListener('input', function() {
            rainSpeedFactor = parseFloat(slider_rain.value);
          });
    
        document.getElementById('pumpButton').addEventListener('click', () => {
          if (objectToAnimate && material) {
              if (isGray) {
                  let progress = 0;
                  isAnimating = true;
      
                  const interval = setInterval(() => {
                      progress += 0.01;  
                      changeObjectColor(progress);  
      
                      if (progress >= 1) {
                          clearInterval(interval);  
                          isAnimating = false;
                          isGray = false;  
                      }
                  }, 30); 
              } else {
                  changeObjectColor(0); 
                  isGray = true; 
              }
          }
      });
        



      const specificObject = model.getObjectByName('water1');
      const clip = THREE.AnimationClip.findByName(gltf.animations, 'water1Animation.001');
      const action = mixer.clipAction(clip, specificObject);
      if (specificObject) {
          
      
          let animateFlag = false;
          document.getElementById('tankButton').addEventListener('click', () => {
              animateFlag = !animateFlag;
              if (animateFlag) {
                  action.reset().play();
                  setTimeout(() => {
                    action.paused = true;  
                }, 5000);  
              } else {
                  action.reset().stop();  // stop the animation
              }
          });
      } else {
          console.error('Object not found in the scene');
      }
        
          
           
          socket1.addEventListener('message', (event) => {
            try {
              const result = JSON.parse(event.data);

              Object.keys(result).forEach(key => {
                  receivedData1[key] = result[key];
              });
                    if (receivedData1.motor !== undefined) {
                        const progressValue = receivedData1.motor;
                        changeObjectColor(progressValue);  
                    }

                    if (receivedData1.tankanimation !== undefined) {    // 1 for play, 0 for pause
                        const playAnimationValue = receivedData1.tankanimation;

                    if (playAnimationValue === 1) {
                        action.reset().play(); 
                      } 
                    else if (playAnimationValue === 0) {
                        action.reset().stop();  
                      }
                    }
              } catch (error) {
                    console.error('Error parsing data from Node-RED:', error);
              }
        });
    });
    


    

// /home/helvetiker_regular.typeface.json
    const fontLoader = new THREE.FontLoader();
    fontLoader.load('/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
      font = loadedFont;
      createTemperatureText('20°C', new THREE.Color(0.6, 1, 0.6));
    });


    window.addEventListener('resize', onWindowResize, false);

    document.getElementById('layerSlider').addEventListener('input', onLayerSliderChange);
    document.getElementById('soilSlider').addEventListener('input', onsoilSliderChange);
    document.getElementById('tankSlider').addEventListener('input', ontankSliderChange);
    document.getElementById('colorSlider').addEventListener('input', onColorSliderChange);
    document.getElementById('pipeSlider').addEventListener('input', onpipeSliderChange);
    document.getElementById('cloudPositionSlider').addEventListener('input', onCloudPositionSliderChange);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
  }

    function updateLayerPositions(normalizedValue) {
      const initialYPositions = {
          layer1: 0.50844,
          layer2: 0.52983,
          layer3: 0.56831,
          layer4: 0.61044,
          layer5: 0.65029,
          layer6: 0.68761,
      };
      const roofY = -0.25;

      Object.entries(layers).forEach(([layerName, layer]) => {
          if (layer) {
              layer.position.y = initialYPositions[layerName] + (roofY - initialYPositions[layerName]) * normalizedValue;
          }
      });
  }
  function onLayerSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = sliderValue / 100;

    updateLayerPositions(normalizedValue); 
  }


  // Function to update only the color of the specified layers
  function updateLayerColorOnly(normalizedValue) {
    const startColor = new THREE.Color(0, 0.2, 0);  // Green from your image (#008000)
    const targetColor = new THREE.Color(0.2, 0.05, 0);  // Darker brown color
  
    // List the layers you want to change color for
    const layersToChange = ['layer6', 'layer5'];

    layersToChange.forEach(layerName => {
        const layer = layers[layerName];
        if (layer) {
            layer.traverse((child) => {
                if (child.isMesh && child.material) {  
                    child.material.color.r = startColor.r + (targetColor.r - startColor.r) * normalizedValue;
                    child.material.color.g = startColor.g + (targetColor.g - startColor.g) * normalizedValue;
                    child.material.color.b = startColor.b + (targetColor.b - startColor.b) * normalizedValue;
                    child.material.needsUpdate = true;  // Mark the material for an update
                }
            });
        } else {
            console.error(`Layer ${layerName} not found`);
        }
    });
  }

  // Original function for updating both color and lighting
  function updateColorAndLight(normalizedValue) {
    updateLayerColorOnly(normalizedValue);  // Call the color update function

  // Update light intensity based on the slider value
    directionalLight.intensity = 1 + 2 * normalizedValue;

  // If you have text that shows the temperature based on color, update it as well
    if (temperatureText && font) {
        const newTemperature = 20 + 20 * normalizedValue;
        const newText = `${newTemperature.toFixed(1)}°C`;

        const textColor = new THREE.Color().lerpColors(
            new THREE.Color(0.6, 1, 0.6),  // Cooler color
            new THREE.Color(1, 0.6, 0.6),  // Warmer color
            normalizedValue
        );

        scene.remove(temperatureText);  // Remove old text
        createTemperatureText(newText, textColor);  // Add new text with updated color
    }
  }


  function onColorSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = sliderValue / 100;

    //updateColorAndLight(normalizedValue);  
    updateLayerColorOnly(normalizedValue);
  }



  function updateSoilOpacity(normalizedValue) {
    const soil = model.getObjectByName('Cube');
    if (soil) {
        soil.traverse((child) => {
            if (child.isMesh) {
                child.material.opacity = normalizedValue;
                child.material.transparent = true;
            }
        });
    }
  }

  

  function onsoilSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = 1 - (sliderValue / 100);  

    updateSoilOpacity(normalizedValue);  
    updateDashboard('soilTransparency', sliderValue);
  }

  function updatepipeOpacity(normalizedValue) {
    const pipe = model.getObjectByName('Cylinder_1');
    if (pipe) {
        pipe.traverse((child) => {
            if (child.isMesh) {
                child.material.opacity = normalizedValue;
                child.material.transparent = true;
            }
        });
    }
  }

  

  function onpipeSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = 1 - (sliderValue / 100);  

    updatepipeOpacity(normalizedValue);
    updateDashboard('pipeTransparency', sliderValue);
  }
  
    function updateTankOpacity(normalizedValue) {
    const tank = model.getObjectByName('tank');
    if (tank) {
        tank.traverse((child) => {
            if (child.isMesh) {
                tank.visible = true;
                child.material.opacity = normalizedValue;
                child.material.transparent = true;
            }
        });
    }
  }

  function ontankSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = 1 - (sliderValue / 100);

    updateTankOpacity(normalizedValue);
    updateDashboard('tankTransparency', sliderValue);
  }
   

   function updateCloudColor(normalizedValue) {
      const skyBlue = { r: 135 / 255, g: 206 / 255, b: 235 / 255 };
      const gray = { r: 128 / 255, g: 128 / 255, b: 128 / 255 };

      const r = skyBlue.r + (gray.r - skyBlue.r) * normalizedValue;
      const g = skyBlue.g + (gray.g - skyBlue.g) * normalizedValue;
      const b = skyBlue.b + (gray.b - skyBlue.b) * normalizedValue;

      scene.background = new THREE.Color(r, g, b);
    }
    
  
  function onCloudPositionSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = sliderValue / 100;

    updateCloudColor(normalizedValue);
    updateWeatherStatus(sliderValue);
  }
  

  function createTemperatureText(text, color) {
      if (font) {
          const textGeometry = new TextGeometry(text, {
              font: font,
              size: 0.5,
              height: 0.1,
          });

          const textMaterial = new THREE.MeshBasicMaterial({ color: color });
          temperatureText = new THREE.Mesh(textGeometry, textMaterial);

          temperatureText.position.set(-7, 13, -28);
          temperatureText.rotation.set(0, -80, 0);
          scene.add(temperatureText);
      }
  }

  function sendSliderData(value) {
      if (socket.readyState === WebSocket.OPEN) {
          console.log(`Sending value via WebSocket: ${value}`);
          socket.send(JSON.stringify(value));
      } else {
          console.warn('WebSocket is not open. Ready state:', socket.readyState);
      }
  }

  function debounce(fn, delay) {
      let timeout;
      return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => fn(...args), delay);
      };
  }

  function setupSlider(slide_no) {
      const sl_no={}
      const slider = document.getElementById(slide_no);
      if (slider) {
          slider.addEventListener('input', debounce((event) => {
              const sliderValue = Number(event.target.value);
              sl_no[slide_no]=sliderValue;
              sendSliderData(sl_no);
          }, 10));
      } else {
          console.error('Slider element not found');
      }
  }
  function setupbutton(button_no) { 
    const bt_no = {}; 
    let toggleState = false; 
    const button = document.getElementById(button_no);

    if (button) {
        button.addEventListener('click', debounce(() => {
            toggleState = !toggleState; 
            const valueToSend = toggleState ? 1 : 0;
            bt_no[button_no]=valueToSend
            sendSliderData(bt_no); 
        }, 10));
    } else {
        console.error('Button element not found');
    }
  }

  
  function initialize() {
      setupSlider("cloudPositionSlider");
      setupSlider("colorSlider");
      setupSlider("layerSlider");
      setupSlider("tankSlider");
      setupSlider("pipeSlider");
      setupSlider("soilSlider");
      setupSlider("rainSlider");
      setupbutton("pumpButton");
      setupbutton("tankButton");
      setupbutton("rainButton");
     
     // setupSlider("timeSlider");
      
      console.log('WebSocket Client Initialized');
      window.addEventListener('beforeunload', sendPing);
  }
  
  requestData();
  initialize();
  setupScene();
  animate();
}
init();
export { init };
