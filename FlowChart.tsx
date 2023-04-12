import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
  updateEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
} from "react-flow-renderer";
import { UpdateFlowChart, StepType } from "../../common/communication.base";
import { NclFlowChart } from "../../common/components.ncl";
import { useServerState } from "../hooks";
import { StyleHelper, WithContextPlacementProps } from "../k2hoc";
import EdgeFloating from "./EdgeFloating";
import EdgeStraight from "./EdgeStraight";
import NodeCaption from "./NodeCaption";
import NodeEdge from "./NodeEdge";
import NodeStep from "./NodeStep";
import Menubar from "./Menubar";
import "./FlowChart.scss";
import { SvgStepStart, SvgStepEnd, SvgStepTransfer, SvgStepAcknowledge, SvgStepCase, SvgStepDistrib, SvgStepSubModel } from "./SvgStep";

const nodeTypes = {
  Step: NodeStep,
  Caption: NodeCaption,
  Edge: NodeEdge,
};

const edgeTypes = {
  Floating: EdgeFloating,
  straight: EdgeStraight,
};

function K2FlowChartWithProvider(props: WithContextPlacementProps) {
  return (
    <ReactFlowProvider>
      <K2FlowChart controlUID={props.controlUID} vrUID={props.vrUID} style={props.style} />
    </ReactFlowProvider>
  );
}

function K2FlowChart(props: WithContextPlacementProps) {
  const [control, data, element] = useServerState<NclFlowChart, UpdateFlowChart, HTMLDivElement>(
    props.controlUID,
    props.vrUID,
    (ctrl) => ctrl instanceof NclFlowChart
  );
  const zoomLevel = useStore((store) => store.transform[2]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menuActions, setMenuActions] = useState(actions);
  const [hiddenCaptions, setHiddenCaptions] = useState(false);
  const ctrl = useRef(false);
  const clickTime = useRef(-1);
  const clickDetected = useRef(false);
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    if (data.nodes == null || data.edges == null) return;

    const nodes = data.nodes.toJS().map((node) => nodeHideCaptions(node));
    const edges = data.edges.toJS().map((edge) => edgeHideCaptions(edge));

    setNodes(nodes);
    setEdges(edges);

    if (!data.nodesConnectable) {
      setMenuActions(actions);
    }
  }, [data, hiddenCaptions]);

  const onEdgeUpdate = (oldEdge: Edge, newConnection: Connection) => setEdges((els) => updateEdge(oldEdge, newConnection, els));

  const nodeHideCaptions = (originalNode: unknown) => {
    const node = originalNode as Node;

    if (node.type == "Caption") node.hidden = hiddenCaptions;
    return node;
  };
  const edgeHideCaptions = (originalEdge: unknown) => {
    const edge = originalEdge as Edge;

    if (edge.source.includes("NodeCaption") || edge.target.includes("NodeCaption")) edge.hidden = hiddenCaptions;
    return edge;
  };

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (params.source == null || params.target == null) return;

      const selectedAction = menuActions.find((action) => action.checked === true);
      if (!selectedAction || ["action0"].includes(selectedAction.id)) return;

      let edgeType: string;
      switch (selectedAction.id) {
        case "action8":
          edgeType = "approve";
          break;
        case "action9":
          edgeType = "reject";
          break;
        default:
          return;
      }

      console.log("AddLink", params.source, params.target, edgeType);
      control.addLink(params.source, params.target, edgeType);
    },
    [menuActions]
  );

  function updateActions(actions: MenuActions[]) {
    setMenuActions(actions);

    const selectedAction = actions.find((action) => action.checked === true);

    switch (selectedAction?.id) {
      case "action0":
        console.log("default");
        control.toolBarClick("default");
        break;
      case "action8":
      case "action9":
        console.log("edge");
        control.toolBarClick("edge");
        break;
      default:
        console.log("node");
        control.toolBarClick("node");
        break;
    }
  }

  function updateCtrlKey(ctrlKey: boolean) {
    if (ctrlKey) {
      ctrl.current = true;

      return;
    }

    ctrl.current = false;
  }

  function handleNodeClick(e: React.MouseEvent, node: Node) {
    console.log("NodeClick", node.id);
    control.nodeClick(node.id);
  }

  function handleNodeDoubleClick(e: React.MouseEvent, node: Node) {
    console.log("NodeDoubleClick", node.id);
    control.nodeDoubleClick(node.id);
  }

  function handleEdgeClick(e: React.MouseEvent, edge: Edge) {
    let dlbclick: boolean;
    const now: number = Date.now();
    const diff: number = now - clickTime.current;

    if (clickDetected.current && diff < 400) {
      dlbclick = true;
      clickDetected.current = false;
      clickTime.current = 0;
    } else {
      dlbclick = false;
      clickDetected.current = true;
      clickTime.current = Date.now();
    }

    if (!dlbclick) {
      console.log("EdgeClick", edge.id);
      control.edgeClick(edge.id);
    } else {
      console.log("EdgeDoubleClick", edge.id);
      control.edgeDoubleClick(edge.id);
    }
  }

  function handleNodeDragStop(e: React.MouseEvent, node: Node, nodes: Node[]) {
    

    console.log("NodeDragStop", node.id, node.position.x.toString(), node.position.y.toString());
  }

  function handleClick(e: React.MouseEvent) {
    const selectedAction = menuActions.find((action) => action.checked === true);

    if (!selectedAction || ["action0", "action8", "action9"].includes(selectedAction.id)) return;

    if (!ctrl.current) {
      const newActions = menuActions.map((action) => {
        return {
          ...action,
          checked: action.id === "action0" ? true : false,
        };
      });

      setMenuActions(newActions);
    }

    const reactFlowBounds = element.current?.getBoundingClientRect();

    if (!reactFlowBounds) return;

    const x = (e.clientX - reactFlowInstance.getViewport().x - reactFlowBounds.left) / reactFlowInstance.getViewport().zoom;
    const y = (e.clientY - reactFlowInstance.getViewport().y - reactFlowBounds.top) / reactFlowInstance.getViewport().zoom;

    control.addNode(selectedAction.stepType.toString(), x.toString(), y.toString());
  }

  return (
    <div className={"flc " + (data.nodesConnectable ? "inEdit" : "")} style={StyleHelper(control, props.style)}>
      <Menubar
        actions={menuActions}
        updateActions={updateActions}
        updateCtrlKey={updateCtrlKey}
        hiddenCaptions={hiddenCaptions}
        setHiddenCaptions={setHiddenCaptions}
        zoomLevel={zoomLevel}
      />
      <div ref={element} className="flc_main">
        <div style={{ width: 0, height: 0 }}>
          <svg>
            <defs>
              <marker
                className="react-flow__arrowhead"
                id="arrowDefault"
                markerWidth="12.5"
                markerHeight="12.5"
                viewBox="-10 -10 20 20"
                markerUnits="strokeWidth"
                orient="auto"
                refX="0"
                refY="0"
              >
                <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" points="-6.5,-3.5 0,0 -6.5,3.5 -6.5,-3.5"></polyline>
              </marker>
              <marker
                className="react-flow__arrowhead"
                id="arrowActive"
                markerWidth="12.5"
                markerHeight="12.5"
                viewBox="-10 -10 20 20"
                markerUnits="strokeWidth"
                orient="auto"
                refX="0"
                refY="0"
              >
                <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" points="-6.5,-3.5 0,0 -6.5,3.5 -6.5,-3.5"></polyline>
              </marker>
              <marker
                className="react-flow__arrowhead"
                id="arrowBack"
                markerWidth="12.5"
                markerHeight="12.5"
                viewBox="-10 -10 20 20"
                markerUnits="strokeWidth"
                orient="auto"
                refX="0"
                refY="0"
              >
                <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" points="-6.5,-3.5 0,0 -6.5,3.5 -6.5,-3.5"></polyline>
              </marker>
              <marker
                className="react-flow__arrowhead"
                id="arrowDone"
                markerWidth="12.5"
                markerHeight="12.5"
                viewBox="-10 -10 20 20"
                markerUnits="strokeWidth"
                orient="auto"
                refX="0"
                refY="0"
              >
                <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" points="-6.5,-3.5 0,0 -6.5,3.5 -6.5,-3.5"></polyline>
              </marker>
            </defs>
          </svg>
        </div>
        <ReactFlow
          onClick={handleClick}
          //          onDrop={onDrop}
          //onDragOver={onDragOver}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeClick={handleEdgeClick}
          onNodeDragStop={handleNodeDragStop}
          // onConnect={handleConnection}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeUpdate={onEdgeUpdate}
          onConnect={onConnect}
          panOnDrag={data.panOnDrag}
          // zoomOnScroll={false}
          zoomOnDoubleClick={false}
          nodesDraggable={data.nodesConnectable}
          nodesConnectable={data.nodesConnectable}
          edgeTypes={edgeTypes}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose} //allows connecting Source to Source handle
          connectionLineType={ConnectionLineType.Straight}
        >
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export default K2FlowChartWithProvider;

export interface MenuActions {
  id: string;
  stepType: StepType;
  name: string;
  title: string;
  image: JSX.Element;
  checked: boolean;
}

const actions: MenuActions[] = [
  {
    id: "action0",
    stepType: StepType.itUndefined,
    name: "node",
    title: "Výběr",
    image: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
        />
      </svg>
    ),
    checked: true,
  },
  {
    id: "action1",
    stepType: StepType.itStart,
    name: "node",
    title: "Zahájení",
    image: <SvgStepStart />,
    checked: false,
  },
  {
    id: "action2",
    stepType: StepType.itEnd,
    name: "node",
    title: "Ukončení",
    image: <SvgStepEnd />,
    checked: false,
  },
  {
    id: "action3",
    stepType: StepType.itTransfer,
    name: "node",
    title: "Transformace",
    image: <SvgStepTransfer />,
    checked: false,
  },
  {
    id: "action4",
    stepType: StepType.itAcknowledge,
    name: "node",
    title: "Na vědomí",
    image: <SvgStepAcknowledge />,
    checked: false,
  },
  {
    id: "action5",
    stepType: StepType.itCase,
    name: "node",
    title: "Rozhodnutí",
    image: <SvgStepCase />,
    checked: false,
  },
  {
    id: "action6",
    stepType: StepType.itDistrib,
    name: "node",
    title: "Distribuce",
    image: <SvgStepDistrib />,
    checked: false,
  },
  {
    id: "action7",
    stepType: StepType.itSubModel,
    name: "node",
    title: "Vnořený postup",
    image: <SvgStepSubModel />,
    checked: false,
  },
  {
    id: "action8",
    stepType: StepType.itUndefined,
    name: "edge",
    title: "Spoj",
    image: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
      </svg>
    ),
    checked: false,
  },
  {
    id: "action9",
    stepType: StepType.itUndefined,
    name: "edge",
    title: "Vedlejší spoj",
    image: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
      </svg>
    ),
    checked: false,
  },
];
