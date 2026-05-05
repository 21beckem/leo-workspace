import { Component, createEffect, onMount, onCleanup } from 'solid-js';
import Chart from 'chart.js/auto';

interface GraphProps {
  sample: number;
  maxPoints?: number;
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

		const config: any = {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						label: 'Pot value',
							data: [],
							pointRadius: 0,
							pointHoverRadius: 0
					}
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
						min: -0.1,
						max: 0.1
					}
				}
			}
		};

		myChart = new Chart(myGraphCanvasEl, config);

		createEffect(() => {
			if (!myChart) return;

			const dataset = myChart.data.datasets[0];
			dataset.data.push(props.sample);
			myChart.data.labels?.push(String(pointIndex));
			pointIndex += 1;

			while (dataset.data.length > getMaxPoints()) {
				dataset.data.shift();
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
