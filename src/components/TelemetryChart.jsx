import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import * as echarts from 'echarts';

/**
 * Reusable ECharts component for telemetry visualization
 */
const TelemetryChart = ({ 
  data, 
  title, 
  metrics, 
  colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666'],
  group = 'main'
}) => {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, 'dark');
      // Synchronization logic
      instanceRef.current.group = group;
    }

    const series = metrics.map((metric, i) => ({
      name: metric.label,
      type: 'line',
      data: data.map(item => [item.timestamp, item[metric.key]]),
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 1.5,
        color: colors[i % colors.length]
      },
      areaStyle: metric.fill ? {
        opacity: 0.05,
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: colors[i % colors.length] },
          { offset: 1, color: 'transparent' }
        ])
      } : null,
      yAxisIndex: metric.yAxisIndex || 0,
      markPoint: metric.showPeak ? {
        data: [{ type: 'max', name: 'Peak' }],
        symbol: 'pin',
        symbolSize: 30,
        label: {
          show: true,
          position: 'top',
          color: colors[i % colors.length],
          fontSize: 10,
          formatter: (params) => params.value.toFixed(1)
        },
        itemStyle: { color: 'rgba(0,0,0,0)' }
      } : null
    }));

    const option = {
      backgroundColor: 'transparent',
      title: {
        text: title,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#444',
        textStyle: { color: '#fff' }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#888' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' }
      },
      yAxis: [
        {
          type: 'value',
          name: metrics[0]?.unit,
          axisLine: { lineStyle: { color: '#444' } },
          splitLine: { lineStyle: { color: '#222' } },
          axisLabel: { color: '#888' }
        },
        {
          type: 'value',
          name: metrics.length > 1 ? metrics[1]?.unit : '',
          position: 'right',
          axisLine: { lineStyle: { color: '#444' } },
          splitLine: { show: false },
          axisLabel: { color: '#888' }
        }
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0] },
        { type: 'slider', xAxisIndex: [0], bottom: '25', height: 20 }
      ],
      series
    };

    instanceRef.current.setOption(option);
    echarts.connect(group);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, title, metrics, colors, group]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

export default TelemetryChart;
