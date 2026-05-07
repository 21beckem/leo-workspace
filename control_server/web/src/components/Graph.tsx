import { Component, createEffect, onMount, onCleanup } from 'solid-js';
import Chart from 'chart.js/auto';

interface GraphProps {
  	sample: number;
	demand?: number;
 	maxPoints?: number;
	yBounds?: [number, number];
}

export const Graph: Component<GraphProps> = (props) => {
	let myGraphCanvasEl: HTMLCanvasElement | undefined = undefined;
	let myChart: Chart | undefined = undefined;
	let pointIndex = 0;
	const getMaxPoints = () => props.maxPoints ?? 50;

	onMount(() => {
		if (myChart) {
			myChart.destroy();
			myChart = undefined;
		}
		if (!myGraphCanvasEl) return console.error('Graph canvas not found');
		const hasDemandDataset = props.demand !== undefined;

		const config: any = {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						label: 'Live value',
						data: [],
						borderColor: '#36A2EB',
						backgroundColor: '#36A2EB',
						pointRadius: 0,
						pointHoverRadius: 0,
						borderWidth: 2,
						tension: 0.18,
						fill: false,
					},
					...(hasDemandDataset ? [{
						label: 'Demand',
						data: [],
						borderColor: '#FF9F40',
						backgroundColor: '#FF9F40',
						pointRadius: 0,
						pointHoverRadius: 0,
						borderWidth: 2,
						tension: 0.18,
						fill: false,
					}] : [])
				]
			},
			options: {
				animation: false,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					x: {
						ticks: {
							display: false
						}
					},
					y: {
						min: props.yBounds?.[0] ?? -1.1,
						max: props.yBounds?.[1] ?? 1.1
					}
				}
			}
		};

		myChart = new Chart(myGraphCanvasEl, config);

		createEffect(() => {
			if (!myChart) return;

			const dataset = myChart.data.datasets[0];
			dataset.data.push(props.sample);
			if (hasDemandDataset && myChart.data.datasets[1]) {
				myChart.data.datasets[1].data.push(props.demand ?? props.sample);
			}
			myChart.data.labels?.push(String(pointIndex));
			pointIndex += 1;

			while (dataset.data.length > getMaxPoints()) {
				dataset.data.shift();
				if (hasDemandDataset && myChart.data.datasets[1]) {
					myChart.data.datasets[1].data.shift();
				}
				myChart.data.labels?.shift();
			}

			myChart.update();
		});
	});

	onCleanup(() => {
		if (myChart) {
			myChart.destroy();
			myChart = undefined;
		}
	});
  
  return (
    <canvas style={{
			'width': '100%',
			'height': '100%',
			'background-color': 'transparent',
			'padding': '10px',
		}} ref={myGraphCanvasEl}>
    </canvas>
  );
};
