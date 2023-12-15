import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import Scene, { inputShapes, inputCoords } from "./utils/PolypyramidScene.js"
import Pyramid from './utils/Pyramid.js'
import { convert_to_pyramid_layers } from "./utils/ConvertSolutionFormat.js";
import { generate_headers, populate_problem_matrix3D, reduce_problem_matrix } from "./utils/Generate_problem_matrix3D.js";
import { create_dicts } from "./utils/Create_dict_objects.js";
import { solve } from "./utils/Solver.js";
import { shapeStore } from "./utils/Shapes3D.js";
import Shapes from './components/Shapes.jsx'

export let worker = new Pyramid(5, 1);
const scene = new Scene();

const FPS = 30;
let uiTimer = null;
const createTimer = (func) => {
    if (uiTimer) {
        clearInterval(uiTimer);
        uiTimer = null;
    }

    uiTimer = setInterval(() => {
        func();
    }, 1000 / FPS);
}

window.onbeforeunload = () => {
    if (uiTimer) clearTimeout(uiTimer);
}

const Colours = {
    "A": 0xff0000,
    "B": 0xff0080,
    "C": 0xff99cc,
    "D": 0x0000ff,
    "E": 0xffff00,
    "F": 0xcc6699,
    "G": 0x660033,
    "H": 0x4dff4d,
    "I": 0xe65c00,
    "J": 0x7e22ce,
    "K": 0xff9900,
    "L": 0x00bfff
}

// Change the color value stored in matrix
export function setSphereColor(x, y, layer, color) {
    worker.layers[layer][x][y].color.set(color);
}

function renderPyramid() {
    for (let i = 0; i < worker.layers.length; i++) {
        const spheres = worker.layers[i].matrix;
        for (let x = 0; x < worker.layers[i].size; x++) {
            for (let y = 0; y < worker.layers[i].size; y++) {
                let pos = spheres[x][y].pos;
                let color = spheres[x][y].color;

                if (!spheres[x][y].userData) {
                    spheres[x][y].userData = scene.createSphere(pos[0], pos[1], pos[2], color, worker.radius());
                    scene.add(spheres[x][y].userData);
                } else {
                    spheres[x][y].userData.material.color.set(color);
                    spheres[x][y].userData.material.specular.set(color);
                    // spheres[x][y].userData.material.needsUpdate = true;
                }
            }
        }
    }
}

function disposePyramid() {
    for (let i = 0; i < worker.layers.length; i++) {
        const spheres = worker.layers[i].matrix;
        for (let x = 0; x < worker.layers[i].size; x++) {
            for (let y = 0; y < worker.layers[i].size; y++) {
                if (!spheres[x][y].userData) {
                    scene.disposeSphere(spheres[x][y].userData);
                }
            }
        }
    }
}

function layerVisible(idx, v) {
    console.log("layerVisible " + idx + v)
    let layer = worker.getLayer(idx);
    const spheres = layer.matrix;
    for (let x = 0; x < layer.size; x++) {
        for (let y = 0; y < layer.size; y++) {
            if (spheres[x][y].userData) {
                spheres[x][y].userData.visible = v;
                spheres[x][y].visible = v;
                spheres[x][y].userData.needsUpdate = true;
                console.log("?")
            }
        }
    }
}


let input;
let input_shapes;
let input_squares;
let problem_mat;
let problem_def;
let headers;
let dicts;

function App() {
	const panel = useRef()
	const shape = useRef()
	const inputX = useRef()
	const inputY = useRef()
	const inputZ = useRef()

	const [stopExecution, setStopExecution] = useState(false)
	const [solutionCount, setSolutionCount] = useState(0)
	const [solutions, setSolutions] = useState([])
	const [isFourLevel, setIsFourLevel] = useState(false)

	// Used to draw solution pyramid (position output from backend)
    const drawPosition = (position) => {
        for (let layer = 0; layer < position.length; layer++) {
            for (let i = 0; i < position[layer].length; i++) {
                for (let j = 0; j < position[layer].length; j++) {
                    if (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].indexOf(position[layer][i][j]) !== -1) {
                        // Set to shape colour
                        worker.getLayer(5 - layer).set(i, j, Colours[position[layer][i][j]]);
                    }
                    else {
                        // Set to black to indicate empty
                        worker.getLayer(5 - layer).set(i, j, 0x233333);
                    }
                }
            }
        }
        renderPyramid();
    }

    const checkInput = (shapes, coords) => {
        for (let i = 0; i < shapes.length; i++) {
            if (shapeStore[shapes[i]].layout.length !== coords[i].length) {
                // Wrong number of spheres for shape, abort.
                return false;
            }
        }
        return true;
    }

    const onFourLevelCheckChange = () => {
        setIsFourLevel(isFourLevel => !isFourLevel)
        onFourLevelStateChange()
        // this.setState({ isFourLevel: !this.state.isFourLevel }, () => this.onFourLevelStateChange());
    }

    const onFourLevelStateChange = () => {
        if (isFourLevel) {
            document.getElementById("l5").checked = false;
            document.getElementById("l5").disabled = true;
            layerVisible(5, false);
            onClearButtonClick();
        }
        else {
            document.getElementById("l5").checked = true;
            document.getElementById("l5").disabled = false;
            layerVisible(5, true);
            onClearButtonClick();
        }
    }

    const onSolveButtonClick = () => {
		setSolutionCount(0)
		setSolutions([])
		setStopExecution(false)

        input_shapes = inputShapes.get();
        input_squares = inputCoords.get();
        // If incorrect number of spheres for shape, abort.
        if (!checkInput(input_shapes, input_squares)) {
            return;
        }

        problem_mat = populate_problem_matrix3D();
        problem_def = reduce_problem_matrix(problem_mat, generate_headers(problem_mat), input_shapes, input_squares, isFourLevel);
        problem_mat = problem_def[0];
        /*
        let test = 0;
        for (let i of problem_mat) {
            //console.log(i);
            if (i[0] === 1) {
                for (let j = 12; j < 37; j++) {
                    if (i[j] !== 0) {
                        break;
                    }
                    if (j === 36) {
                        console.log(i);
                        test += 1;
                    }
                }
            }
        }*/
        //console.log(test);
        headers = problem_def[1];
        dicts = create_dicts(problem_mat, headers, isFourLevel);
        let ret = solve(dicts[0], dicts[1], [], isFourLevel, headers);
        let cnt = 0;
        createTimer(() => {
            let arr = ret.next().value;

            if (!arr) {
                clearInterval(uiTimer);
                uiTimer = null;

                return;
            }
            cnt++;
			setSolutionCount(cnt)
            let pyramid_layers = convert_to_pyramid_layers(arr, problem_mat, headers, input_shapes, input_squares);
			setSolutions(solutions => [...solutions, pyramid_layers])
            drawPosition(pyramid_layers);
        });
    };

    const onNextButtonClick = () => {
        drawPosition(solutions.pop());
    }

    const onClearButtonClick = () => {
        inputShapes.clear();
        inputCoords.clear();
		setSolutions([])
		setSolutionCount(0)
        
        //  Set pyramid to empty and render empty pyramid
        let empty_position = new Array(5);
        for (let i = 0; i < 5; i++) {
            empty_position[i] = new Array(5 - i);
            empty_position[i].fill(0);
        }
        for (let layer = 0; layer < 5; layer++) {
            for (let row = 0; row < 5 - layer; row++) {
                empty_position[layer][row] = new Array(5 - layer);
                empty_position[layer][row].fill(0);
            }
        }
        drawPosition(empty_position);
    };

    const onStopButtonClick = () => {
		setStopExecution(true)
        clearInterval(uiTimer);
        uiTimer = null;
    }

	useEffect(() => {
		scene.init(panel.current);
        renderPyramid();

		return () => scene.dispose()
	}, [])

    const onInputClick = () => {
        console.log(this.inputRef.shape.current.value);
        console.log(this.inputRef.inputX.current.value);
        console.log(this.inputRef.inputY.current.value);
        console.log(this.inputRef.inputZ.current.value);
    }

	return (
		<div className="my-4">
            <div className="container space-y-6 mx-auto">
                <Shapes />
                <div className="grid grid-cols-2">
                    <div ref={panel} className="panel rounded-xl overflow-hidden">
                    </div>
                    <div className="flex flex-col justify-center items-center gap-5">
                        <p className=' font-normal text-base text-gray-700'>
                            Solutions found:{' '}
                            <span className='font-medium text-xl text-gray-900'>
                                { solutionCount }
                            </span>
                        </p>
                        <div className="">
                            <input id="isFourCheck" className="pr-4" type="checkbox" onChange={() => onFourLevelCheckChange()} />
                            <label htmlFor="isFourCheck">4 Level Pyramid</label>
                        </div>
                        <div id="positionInputForm" className='flex items-center gap-4'>
                            <button type="button" className='px-3 py-1 rounded-md text-sm font-normal bg-green-200' onClick={() => onSolveButtonClick()}>Solve</button>
                            <button type="button" className='px-3 py-1 rounded-md text-sm font-normal bg-red-200' onClick={() => onStopButtonClick()}>Stop</button>
                            <button type="button" className='px-3 py-1 rounded-md text-sm font-normal bg-blue-200' onClick={() => onNextButtonClick()}>Display Next</button>
                            <button type="button" className='px-3 py-1 rounded-md text-sm font-normal bg-yellow-200' onClick={() => onClearButtonClick()}>Clear</button>
                        </div>
                        <div className="flex gap-9 items-center">
                            <div className="text-left space-y-1">
                                <label className="block" htmlFor="inputShape">Shape</label>
                                <input ref={shape} id="inputShape" className="border px-3 py-2 rounded-lg" type="text"
                                    onKeyUp={(e) => { e.target.value = e.target.value.replace(/[^A-La-l]/g, '').toUpperCase(); }} defaultValue="A">
                                </input>
                            </div>
                            <div className="flex items-center gap-3">
                                <div class="flex">
                                    <input type="checkbox" 
                                        class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                                        id="l1"
                                        onChange={(e) => layerVisible(1, e.target.checked)}
                                        defaultChecked
                                    />
                                    <label for="hs-default-checkbox" class="text-sm text-gray-500 ms-3">1</label>
                                </div>
                                <div class="flex">
                                    <input type="checkbox" 
                                        class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                                        id="l2"
                                        onChange={(e) => layerVisible(2, e.target.checked)}
                                        defaultChecked
                                    />
                                    <label for="hs-default-checkbox" class="text-sm text-gray-500 ms-3">2</label>
                                </div>
                                <div class="flex">
                                    <input type="checkbox" 
                                        class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                                        id="l3"
                                        onChange={(e) => layerVisible(3, e.target.checked)}
                                        defaultChecked
                                    />
                                    <label for="hs-default-checkbox" class="text-sm text-gray-500 ms-3">3</label>
                                </div>
                                <div class="flex">
                                    <input type="checkbox" 
                                        class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                                        id="l4"
                                        onChange={(e) => layerVisible(4, e.target.checked)}
                                        defaultChecked
                                    />
                                    <label for="hs-default-checkbox" class="text-sm text-gray-500 ms-3">4</label>
                                </div>
                                <div class="flex">
                                    <input type="checkbox" 
                                        class="shrink-0 mt-0.5 border-gray-200 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" 
                                        id="l5"
                                        onChange={(e) => layerVisible(5, e.target.checked)}
                                        defaultChecked
                                    />
                                    <label for="hs-default-checkbox" class="text-sm text-gray-500 ms-3">5</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
		</div>
	)
}

export default App
