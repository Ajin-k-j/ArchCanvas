import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Layout, 
  MousePointer2, 
  Hand, 
  Box, 
  Layers, 
  Trash2, 
  Maximize, 
  Minimize, 
  Play, 
  Edit3, 
  X,
  Zap,
  Grid,
  Info,
  MoveRight,
  MoveLeft,
  MoveHorizontal,
  Minus,
  Lock,
  Unlock,
  List,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  FileJson,
  FileText,
  Type
} from 'lucide-react';

/**
 * --- CORE UTILITIES ---
 */

const generateId = () => Math.random().toString(36).substr(2, 9);

// CONSTANTS FOR VISUAL OFFSETS
const CONTAINER_HEADER_HEIGHT = 40; // Approx height of the header bar
const CONTAINER_PADDING = 8;        // p-2 = 8px

const getGlobalPosition = (nodeId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { x: 0, y: 0, width: 0, height: 0 };

  let x = node.x;
  let y = node.y;
  let currentParentId = node.parentId;

  let depth = 0;
  while (currentParentId && depth < 50) {
    const parent = nodes.find((n) => n.id === currentParentId);
    if (!parent) break;
    
    // Add Parent's position
    x += parent.x;
    y += parent.y;

    // FIX: Add offset for Container Header and Padding
    // Children are rendered inside a relative div that is pushed down by the header
    if (parent.type === 'container') {
       x += CONTAINER_PADDING;
       y += CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING; 
    }

    currentParentId = parent.parentId;
    depth++;
  }

  return { x, y, width: node.width, height: node.height };
};

const isPointInRect = (x, y, rect) => {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
};

const getDescendants = (nodeId, nodes) => {
  let descendants = [];
  const children = nodes.filter(n => n.parentId === nodeId);
  children.forEach(child => {
    descendants.push(child.id);
    descendants = [...descendants, ...getDescendants(child.id, nodes)];
  });
  return descendants;
};

// Calculate the best anchor point on the border of a node relative to another point
const getAnchorPoint = (sourceRect, targetCenter) => {
  const sourceCenter = {
    x: sourceRect.x + sourceRect.width / 2,
    y: sourceRect.y + sourceRect.height / 2
  };

  const angle = Math.atan2(targetCenter.y - sourceCenter.y, targetCenter.x - sourceCenter.x) * (180 / Math.PI);
  
  let dir = 'right';
  let x = 0;
  let y = 0;

  if (angle >= -45 && angle < 45) {
    dir = 'right';
    x = sourceRect.x + sourceRect.width;
    y = sourceCenter.y;
  } else if (angle >= 45 && angle < 135) {
    dir = 'bottom';
    x = sourceCenter.x;
    y = sourceRect.y + sourceRect.height;
  } else if ((angle >= 135 && angle <= 180) || (angle >= -180 && angle < -135)) {
    dir = 'left';
    x = sourceRect.x;
    y = sourceCenter.y;
  } else {
    dir = 'top';
    x = sourceCenter.x;
    y = sourceRect.y;
  }

  return { x, y, dir };
};

// --- LAYOUT ALGORITHM UTILITIES ---

const performLayoutForScope = (nodesInScope, allEdges) => {
  if (nodesInScope.length === 0) return { positions: {}, width: 0, height: 0 };

  const graph = {};
  const reverseGraph = {};
  nodesInScope.forEach(n => {
    graph[n.id] = [];
    reverseGraph[n.id] = [];
  });

  allEdges.forEach(e => {
    const sourceNode = nodesInScope.find(n => n.id === e.source);
    const targetNode = nodesInScope.find(n => n.id === e.target);
    if (sourceNode && targetNode) {
      graph[e.source].push(e.target);
      reverseGraph[e.target].push(e.source);
    }
  });

  const ranks = {};
  const visited = new Set();
  const queue = [];

  nodesInScope.forEach(n => {
    if (reverseGraph[n.id].length === 0) {
      ranks[n.id] = 0;
      queue.push(n.id);
      visited.add(n.id);
    }
  });

  if (queue.length === 0 && nodesInScope.length > 0) {
    ranks[nodesInScope[0].id] = 0;
    queue.push(nodesInScope[0].id);
    visited.add(nodesInScope[0].id);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift();
    const currentRank = ranks[nodeId];
    
    graph[nodeId].forEach(neighborId => {
      if (!visited.has(neighborId)) {
        ranks[neighborId] = currentRank + 1;
        visited.add(neighborId);
        queue.push(neighborId);
      } else {
        if (ranks[neighborId] <= currentRank) {
           ranks[neighborId] = currentRank + 1;
        }
      }
    });
  }

  nodesInScope.forEach(n => {
    if (ranks[n.id] === undefined) ranks[n.id] = 0;
  });

  const nodesByRank = [];
  Object.keys(ranks).forEach(id => {
    const r = ranks[id];
    if (!nodesByRank[r]) nodesByRank[r] = [];
    nodesByRank[r].push(id);
  });

  const HORIZONTAL_SPACING = 100;
  const VERTICAL_SPACING = 60;   
  const PADDING = 40;            

  let currentX = PADDING;
  const newPositions = {};

  let maxX = 0;
  let maxY = 0;

  nodesByRank.forEach(rankGroup => {
    if (!rankGroup) return;
    
    let currentY = PADDING;
    let maxColWidth = 0;

    rankGroup.sort(); 

    rankGroup.forEach(nodeId => {
      const node = nodesInScope.find(n => n.id === nodeId);
      newPositions[nodeId] = { x: currentX, y: currentY };
      
      currentY += node.height + VERTICAL_SPACING;
      maxColWidth = Math.max(maxColWidth, node.width);
      maxY = Math.max(maxY, currentY);
    });

    currentX += maxColWidth + HORIZONTAL_SPACING;
    maxX = Math.max(maxX, currentX);
  });

  return { positions: newPositions, width: maxX, height: maxY };
};

// Expand parents recursively if child grows
const expandParents = (nodes, changedNodeId) => {
  let updatedNodes = [...nodes];
  let currentId = changedNodeId;
  
  for(let i=0; i<50; i++) {
     const child = updatedNodes.find(n => n.id === currentId);
     if(!child || !child.parentId) break;

     const parentIndex = updatedNodes.findIndex(n => n.id === child.parentId);
     if(parentIndex === -1) break;
     
     const parent = updatedNodes[parentIndex];
     
     // Check if child is out of bounds
     const PADDING = 20;
     
     // Visual offset for children inside container
     const VISUAL_OFFSET_X = CONTAINER_PADDING;
     const VISUAL_OFFSET_Y = CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING;

     const requiredWidth = child.x + child.width + PADDING + VISUAL_OFFSET_X;
     const requiredHeight = child.y + child.height + PADDING + VISUAL_OFFSET_Y;
     
     let newWidth = parent.width;
     let newHeight = parent.height;
     let changed = false;

     if (requiredWidth > parent.width) {
       newWidth = requiredWidth;
       changed = true;
     }
     if (requiredHeight > parent.height) {
       newHeight = requiredHeight;
       changed = true;
     }

     if (changed) {
       updatedNodes[parentIndex] = { ...parent, width: newWidth, height: newHeight };
       currentId = parent.id; 
     } else {
       break; 
     }
  }
  return updatedNodes;
};


/**
 * --- COMPONENTS ---
 */

// 1. Connection Layer
const ConnectionLayer = ({ nodes, edges, selectedEdgeId, onSelectEdge }) => {
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-[100]">
      <defs>
        <marker id="arrowhead-end" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M2,2 L10,6 L2,10 L2,2" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-end-selected" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M2,2 L10,6 L2,10 L2,2" fill="#3b82f6" />
        </marker>
        <marker id="arrowhead-start" markerWidth="12" markerHeight="12" refX="2" refY="6" orient="auto">
          <path d="M10,2 L2,6 L10,10 L10,2" fill="#94a3b8" />
        </marker>
         <marker id="arrowhead-start-selected" markerWidth="12" markerHeight="12" refX="2" refY="6" orient="auto">
          <path d="M10,2 L2,6 L10,10 L10,2" fill="#3b82f6" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const sourceRect = getGlobalPosition(edge.source, nodes);
        const targetRect = getGlobalPosition(edge.target, nodes);

        const sourceCenter = { x: sourceRect.x + sourceRect.width/2, y: sourceRect.y + sourceRect.height/2 };
        const targetCenter = { x: targetRect.x + targetRect.width/2, y: targetRect.y + targetRect.height/2 };

        const start = getAnchorPoint(sourceRect, targetCenter);
        const end = getAnchorPoint(targetRect, sourceCenter);

        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        const controlDist = Math.max(dist * 0.4, 40);

        let cp1 = { x: start.x, y: start.y };
        let cp2 = { x: end.x, y: end.y };

        switch(start.dir) {
            case 'right': cp1.x += controlDist; break;
            case 'left': cp1.x -= controlDist; break;
            case 'bottom': cp1.y += controlDist; break;
            case 'top': cp1.y -= controlDist; break;
        }

        switch(end.dir) {
            case 'right': cp2.x += controlDist; break;
            case 'left': cp2.x -= controlDist; break;
            case 'bottom': cp2.y += controlDist; break;
            case 'top': cp2.y -= controlDist; break;
        }

        const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
        const isSelected = selectedEdgeId === edge.id;

        // Calculate mid point of Bezier for text label (approx t=0.5)
        // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
        const t = 0.5;
        const mt = 1-t;
        const labelX = (mt*mt*mt)*start.x + 3*(mt*mt)*t*cp1.x + 3*mt*(t*t)*cp2.x + (t*t*t)*end.x;
        const labelY = (mt*mt*mt)*start.y + 3*(mt*mt)*t*cp1.y + 3*mt*(t*t)*cp2.y + (t*t*t)*end.y;

        let strokeDasharray = "0";
        if (edge.style === 'dashed') strokeDasharray = "8,5";
        if (edge.style === 'dotted') strokeDasharray = "3,3";
        
        const arrowType = edge.arrow || 'end'; 
        
        let markerEnd = null;
        let markerStart = null;

        if (arrowType === 'end' || arrowType === 'both') {
            markerEnd = isSelected ? "url(#arrowhead-end-selected)" : "url(#arrowhead-end)";
        }
        if (arrowType === 'start' || arrowType === 'both') {
            markerStart = isSelected ? "url(#arrowhead-start-selected)" : "url(#arrowhead-start)";
        }

        // Approx width for label background: 6px per char + padding
        const labelText = edge.label || "";
        const labelWidth = Math.max(24, labelText.length * 6 + 16);

        return (
          <g 
            key={edge.id} 
            className="pointer-events-auto cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              onSelectEdge(edge.id);
            }}
          >
            <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
            <path
              d={path}
              stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
              strokeWidth={isSelected ? "3" : "2"}
              fill="none"
              strokeDasharray={strokeDasharray}
              markerEnd={markerEnd}
              markerStart={markerStart}
              className="group-hover:stroke-blue-400 transition-colors duration-200"
            />
            {/* Edge Label */}
            {edge.label && (
                <g transform={`translate(${labelX}, ${labelY})`}>
                    <rect 
                        x={-labelWidth / 2} 
                        y="-12" 
                        width={labelWidth} 
                        height="24" 
                        rx="4" 
                        fill="white" 
                        className="stroke-slate-200" 
                        strokeWidth="1" 
                    />
                    <text x="0" y="4" textAnchor="middle" fontSize="10" className="fill-slate-600 font-medium select-none pointer-events-none">
                        {edge.label}
                    </text>
                </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// 2. Node Component
const NodeComponent = ({ 
  node, 
  allNodes, 
  onDragStart, 
  onResizeStart,
  selectedId, 
  onSelect,
  isPresentation,
  isConnectMode,
  connectingSourceId,
  onConnectClick,
  editingId,
  setEditingId,
  onUpdateLabel
}) => {
  const children = allNodes.filter((n) => n.parentId === node.id);
  const isSelected = selectedId === node.id;
  const isConnectingSource = connectingSourceId === node.id;
  const isEditing = editingId === node.id;
  const isContainer = node.type === 'container';
  const isText = node.type === 'text';
  
  const [tempLabel, setTempLabel] = useState(node.label);

  useEffect(() => {
    setTempLabel(node.label);
  }, [node.label]);

  const handleMouseDown = (e) => {
    if (isPresentation) {
      e.stopPropagation();
      onSelect(node.id);
      return;
    }
    if (isConnectMode) {
       e.stopPropagation();
       onConnectClick(node.id);
       return;
    }
    e.stopPropagation();
    onSelect(node.id);
    if (!isEditing) {
      onDragStart(e, node.id);
    }
  };

  const handleResizeMouseDown = (e, handle) => {
    e.stopPropagation();
    onResizeStart(e, node.id, handle);
  };

  const handleDoubleClick = (e) => {
    if (isPresentation) return;
    e.stopPropagation();
    setEditingId(node.id);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { // Allow shift+enter for new lines in text nodes
      onUpdateLabel(node.id, tempLabel);
      setEditingId(null);
    }
  };

  const handleBlur = () => {
    onUpdateLabel(node.id, tempLabel);
    setEditingId(null);
  };

  let baseClasses = `absolute flex flex-col transition-shadow duration-200 group `;
  if (isContainer) {
    baseClasses += `bg-white/60 backdrop-blur-md border-2 rounded-xl `;
    baseClasses += isSelected ? `border-blue-500 shadow-xl z-20 ` : `border-slate-300 shadow-sm z-10 hover:border-slate-400 `;
  } else if (isText) {
    baseClasses += `bg-transparent hover:bg-white/30 rounded-lg p-2 items-start justify-start `;
    baseClasses += isSelected ? `border-2 border-blue-500 shadow-lg z-20 bg-white/50 ` : `border border-transparent hover:border-slate-200 z-10 `;
  } else {
    baseClasses += `bg-white border rounded-lg items-center justify-center `;
    baseClasses += isSelected ? `border-blue-500 shadow-lg ring-2 ring-blue-100 z-20 ` : `border-slate-200 shadow-md z-10 hover:border-blue-300 `;
  }

  if (isConnectingSource) baseClasses += `ring-4 ring-blue-200 border-blue-500 `;
  
  if (isPresentation) {
    baseClasses += 'cursor-pointer ';
  } else if (isConnectMode) {
    baseClasses += 'cursor-crosshair ';
  } else if (!isEditing) {
    baseClasses += 'cursor-grab active:cursor-grabbing ';
  }

  // Tooltip Visibility Logic
  const showTooltip = node.description && (!isEditing && (isSelected && isPresentation));

  return (
    <div
      style={{
        left: node.x,
        top: node.y,
        width: Math.max(node.width, isContainer ? 100 : 80),
        height: Math.max(node.height, isContainer ? 80 : 30),
      }}
      className={baseClasses}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Content Rendering based on type */}
      {isText ? (
         <div className="w-full h-full">
            {isEditing ? (
                <textarea 
                    autoFocus
                    className="w-full h-full bg-white/80 rounded resize-none text-sm outline-none p-1"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onMouseDown={(e) => e.stopPropagation()} 
                />
            ) : (
                <div className="w-full h-full whitespace-pre-wrap break-words text-slate-700 text-sm leading-relaxed">
                    {node.label || "Double click to add text..."}
                </div>
            )}
         </div>
      ) : (
        <div className={`w-full flex items-center px-3 py-2 ${isContainer ? 'border-b border-slate-200/50 bg-slate-50/50 rounded-t-xl h-auto min-h-[40px]' : 'h-full justify-center text-center'}`}>
            {isContainer && <Layers size={14} className="text-slate-400 mr-2 flex-shrink-0" />}
            {isContainer && node.locked && <Lock size={12} className="text-amber-500 mr-2 flex-shrink-0" />}
            {!isContainer && !isEditing && <Box size={14} className="text-blue-500 mr-2 flex-shrink-0" />}
            
            {isEditing ? (
            <input 
                autoFocus
                className="w-full bg-white border border-blue-300 rounded px-1 py-0.5 text-xs outline-none"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onMouseDown={(e) => e.stopPropagation()} 
                onFocus={(e) => e.target.select()} 
            />
            ) : (
            <span className={`text-sm font-medium whitespace-normal break-words leading-tight ${isContainer ? 'text-slate-600' : 'text-slate-700 select-none'}`}>
                {node.label}
            </span>
            )}
        </div>
      )}

      {/* Tooltip for non-text nodes */}
      {!isText && node.description && !isEditing && (
          <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg transition-opacity z-[100] pointer-events-none ${showTooltip ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
             {node.description}
             <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></div>
          </div>
      )}

      {isContainer && (
        <div className="relative w-full h-full p-2 overflow-visible">
          {children.map((child) => (
            <NodeComponent
              key={child.id}
              node={child}
              allNodes={allNodes}
              onDragStart={onDragStart}
              onResizeStart={onResizeStart}
              selectedId={selectedId}
              onSelect={onSelect}
              isPresentation={isPresentation}
              isConnectMode={isConnectMode}
              connectingSourceId={connectingSourceId}
              onConnectClick={onConnectClick}
              editingId={editingId}
              setEditingId={setEditingId}
              onUpdateLabel={onUpdateLabel}
            />
          ))}
        </div>
      )}

      {isSelected && !isPresentation && !isConnectMode && (
        <>
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-transparent cursor-nwse-resize z-30 flex items-end justify-end p-0.5" onMouseDown={(e) => handleResizeMouseDown(e, 'se')}><div className="w-2 h-2 bg-blue-500 rounded-sm"></div></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 bg-transparent cursor-nesw-resize z-30 flex items-end justify-start p-0.5" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}><div className="w-2 h-2 bg-white border border-blue-500 rounded-sm"></div></div>
          <div className="absolute top-0 right-0 w-4 h-4 bg-transparent cursor-nesw-resize z-30 flex items-start justify-end p-0.5" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}><div className="w-2 h-2 bg-white border border-blue-500 rounded-sm"></div></div>
        </>
      )}
    </div>
  );
};

// 3. Recursive Tree Item
const TreeItem = ({ node, allNodes, onSelect, selectedId, level = 0 }) => {
  const children = allNodes.filter(n => n.parentId === node.id);
  const [expanded, setExpanded] = useState(true);
  
  const Icon = node.type === 'container' ? Layers : node.type === 'text' ? Type : Box;

  return (
    <div className="w-full">
      <div 
        className={`flex items-center px-2 py-1.5 cursor-pointer text-xs rounded-md transition-colors ${selectedId === node.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {children.length > 0 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-slate-200 rounded mr-1"
          >
            {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
          </button>
        ) : (
          <div className="w-4 mr-1"></div>
        )}
        
        <Icon size={14} className="mr-2 opacity-70"/>
        <span className="truncate">{node.label || (node.type === 'text' ? 'Text Note' : 'Untitled')}</span>
      </div>
      
      {expanded && children.map(child => (
        <TreeItem 
          key={child.id} 
          node={child} 
          allNodes={allNodes} 
          onSelect={onSelect} 
          selectedId={selectedId} 
          level={level + 1} 
        />
      ))}
    </div>
  );
};


/**
 * --- MAIN APP ---
 */
export default function FlowArchitect() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [mode, setMode] = useState('select'); 
  const [selectedId, setSelectedId] = useState(null); 
  const [selectionType, setSelectionType] = useState(null); 
  const [editingId, setEditingId] = useState(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const [dragging, setDragging] = useState(null); 
  const [resizing, setResizing] = useState(null);
  const [panning, setPanning] = useState(null);
  const [connectingSource, setConnectingSource] = useState(null);
  const [pinchDist, setPinchDist] = useState(null); // For pinch zoom

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const screenToWorld = (screenX, screenY) => {
    return {
      x: (screenX - view.x) / view.scale,
      y: (screenY - view.y) / view.scale,
    };
  };

  const addNode = (type) => {
    const isContainer = type === 'container';
    const isText = type === 'text';
    const newId = generateId();
    // Center new node in view
    const worldCenter = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    
    const newNode = {
      id: newId,
      type,
      parentId: null,
      x: worldCenter.x - (isContainer ? 150 : 75),
      y: worldCenter.y - (isContainer ? 100 : 40),
      width: isContainer ? 300 : isText ? 200 : 150,
      height: isContainer ? 200 : isText ? 100 : 80,
      label: isContainer ? 'New Container' : isText ? 'Add your text here...' : 'New Block',
      description: '',
      locked: false 
    };
    setNodes([...nodes, newNode]);
    setSelectedId(newId);
    setSelectionType('node');
    setEditingId(newId);
  };

  const deleteSelection = () => {
    if (!selectedId) return;
    if (selectionType === 'edge') {
      setEdges(edges.filter(e => e.id !== selectedId));
      setSelectedId(null);
      setSelectionType(null);
    } else if (selectionType === 'node') {
      const toDelete = [selectedId, ...getDescendants(selectedId, nodes)];
      setNodes(nodes.filter(n => !toDelete.includes(n.id)));
      setEdges(edges.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target)));
      setSelectedId(null);
      setSelectionType(null);
    }
  };

  const selectAndCenterNode = (id) => {
    setSelectedId(id);
    setSelectionType('node');
    
    const globalPos = getGlobalPosition(id, nodes);
    const nodeCenterX = globalPos.x + globalPos.width / 2;
    const nodeCenterY = globalPos.y + globalPos.height / 2;
    
    const canvasW = window.innerWidth;
    const canvasH = window.innerHeight;
    
    setView(v => ({
      ...v,
      x: (canvasW / 2) - (nodeCenterX * v.scale),
      y: (canvasH / 2) - (nodeCenterY * v.scale)
    }));
  };

  const updateEdgeStyle = (updates) => {
    if (selectionType === 'edge' && selectedId) {
      setEdges(edges.map(e => e.id === selectedId ? { ...e, ...updates } : e));
    }
  };
  
  const updateNodeProperty = (id, updates) => {
      setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleRecursiveLayout = () => {
    let tempNodes = JSON.parse(JSON.stringify(nodes));
    
    const layoutScope = (parentId) => {
        const scopeNodes = tempNodes.filter(n => n.parentId === parentId);
        
        scopeNodes.forEach(node => {
            if (node.type === 'container') {
                layoutScope(node.id);
            }
        });

        // LOCK CHECK
        if (parentId) {
            const parent = tempNodes.find(n => n.id === parentId);
            if (parent && parent.locked) return;
        }

        if (scopeNodes.length > 0) {
            const layoutResult = performLayoutForScope(scopeNodes, edges);
            
            Object.keys(layoutResult.positions).forEach(id => {
                const n = tempNodes.find(x => x.id === id);
                if (n) {
                    n.x = layoutResult.positions[id].x;
                    n.y = layoutResult.positions[id].y;
                }
            });

            if (parentId) {
                const parent = tempNodes.find(n => n.id === parentId);
                if (parent && !parent.locked) { 
                    parent.width = Math.max(parent.width, layoutResult.width + 40); 
                    parent.height = Math.max(parent.height, layoutResult.height + 40);
                }
            }
        }
    };

    layoutScope(null);
    setNodes(tempNodes);
  };

  // EXPORT / IMPORT
  const handleExportData = () => {
    const data = JSON.stringify({ nodes, edges, view }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow-architect-diagram.json';
    a.click();
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.nodes && data.edges) {
            setNodes(data.nodes);
            setEdges(data.edges);
            if (data.view) setView(data.view);
          }
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportPDF = () => {
    // Basic Print Trigger (User can Save as PDF)
    window.print();
  };


  const handleCanvasMouseDown = (e) => {
    // Only handle left click (0) or middle click (1)
    if (e.button === 1 || mode === 'pan') {
      setPanning({ startX: e.clientX, startY: e.clientY, viewStartX: view.x, viewStartY: view.y });
      return;
    }
    
    if (e.target === containerRef.current || e.target.tagName === 'svg') {
      setSelectedId(null);
      setSelectionType(null);
      setEditingId(null);
      if (mode === 'connect') {
         setConnectingSource(null);
      }
    }
  };

  const handleNodeDragStart = (e, nodeId) => {
    if (mode === 'presentation' || resizing || mode === 'connect') return;

    const node = nodes.find(n => n.id === nodeId);
    
    // Check if locked inside parent
    if (node.parentId) {
        const parent = nodes.find(p => p.id === node.parentId);
        if (parent && parent.locked) return; 
    }

    const worldMouse = screenToWorld(e.clientX, e.clientY);
    
    setDragging({
      id: nodeId,
      startX: worldMouse.x,
      startY: worldMouse.y,
      originalX: node.x,
      originalY: node.y
    });
  };

  const handleResizeStart = (e, nodeId, handle) => {
    if (mode === 'presentation') return;
    const node = nodes.find(n => n.id === nodeId);
    const worldMouse = screenToWorld(e.clientX, e.clientY);

    setResizing({
      id: nodeId,
      handle,
      startX: worldMouse.x,
      startY: worldMouse.y,
      startW: node.width,
      startH: node.height,
      nodeStartX: node.x,
      nodeStartY: node.y
    });
  };

  const handleMouseMove = (e) => {
    // Panning
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setView({ ...view, x: panning.viewStartX + dx, y: panning.viewStartY + dy });
      return;
    }

    const worldMouse = screenToWorld(e.clientX, e.clientY);

    // Resizing
    if (resizing) {
      const dx = worldMouse.x - resizing.startX;
      const dy = worldMouse.y - resizing.startY;

      let updatedNodes = nodes.map(n => {
        if (n.id === resizing.id) {
          let newW = resizing.startW;
          let newH = resizing.startH;
          let newX = resizing.nodeStartX;
          let newY = resizing.nodeStartY;

          if (resizing.handle === 'se') {
             newW = Math.max(50, resizing.startW + dx);
             newH = Math.max(40, resizing.startH + dy);
          } else if (resizing.handle === 'sw') {
             newW = Math.max(50, resizing.startW - dx);
             newH = Math.max(40, resizing.startH + dy);
             newX = resizing.nodeStartX + dx; 
          } else if (resizing.handle === 'ne') {
             newW = Math.max(50, resizing.startW + dx);
             newH = Math.max(40, resizing.startH - dy);
             newY = resizing.nodeStartY + dy;
          }
          
          return { ...n, width: newW, height: newH, x: newX, y: newY };
        }
        return n;
      });
      
      updatedNodes = expandParents(updatedNodes, resizing.id);
      setNodes(updatedNodes);
      return;
    }

    // Dragging
    if (dragging) {
      const dx = worldMouse.x - dragging.startX;
      const dy = worldMouse.y - dragging.startY;
      setNodes(prev => prev.map(n => n.id === dragging.id ? 
        { ...n, x: dragging.originalX + dx, y: dragging.originalY + dy } : n
      ));
    }
  };

  const handleMouseUp = (e) => {
    setPanning(null);
    setResizing(null);

    if (dragging) {
      const draggedNode = nodes.find(n => n.id === dragging.id);
      
      if (!draggedNode) {
        setDragging(null);
        return;
      }

      const globalPos = getGlobalPosition(draggedNode.id, nodes);
      const nodeCenterX = globalPos.x + draggedNode.width / 2;
      const nodeCenterY = globalPos.y + draggedNode.height / 2;

      const descendants = getDescendants(draggedNode.id, nodes);
      const candidates = nodes.filter(n => 
        n.type === 'container' && 
        n.id !== draggedNode.id && 
        !descendants.includes(n.id) &&
        !n.locked // Check 1: Don't consider locked containers as targets
      );
      
      candidates.sort((a, b) => (a.width * a.height) - (b.width * b.height));

      let newParent = null;
      for (let container of candidates) {
        const cGlobal = getGlobalPosition(container.id, nodes);
        if (isPointInRect(nodeCenterX, nodeCenterY, { ...cGlobal, width: container.width, height: container.height })) {
          newParent = container;
          break;
        }
      }

      if (newParent && newParent.id !== draggedNode.parentId) {
        const newParentGlobal = getGlobalPosition(newParent.id, nodes);
        setNodes(prev => prev.map(n => n.id === dragging.id ? 
          { ...n, parentId: newParent.id, x: globalPos.x - newParentGlobal.x, y: globalPos.y - newParentGlobal.y } : n
        ));
      } else if (!newParent && draggedNode.parentId !== null) {
        setNodes(prev => prev.map(n => n.id === dragging.id ? 
          { ...n, parentId: null, x: globalPos.x, y: globalPos.y } : n
        ));
      }
      setDragging(null);
    }
  };

  const handleConnectClick = (nodeId) => {
    if (mode !== 'connect') return;

    if (!connectingSource) {
      setConnectingSource(nodeId);
    } else {
      if (connectingSource !== nodeId) {
        if (!edges.find(e => (e.source === connectingSource && e.target === nodeId) || (e.target === connectingSource && e.source === nodeId))) {
           setEdges([...edges, { id: generateId(), source: connectingSource, target: nodeId, style: 'solid', arrow: 'end' }]);
        }
        setConnectingSource(null);
        setMode('select');
      } else {
        setConnectingSource(null); 
      }
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, view.scale - e.deltaY * zoomSensitivity), 5);
      setView(v => ({ ...v, scale: newScale }));
    } else {
      setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  };

  // Pinch Zoom Handlers (Touch)
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
       e.preventDefault(); // Prevent page zoom
       const d = Math.hypot(
         e.touches[0].clientX - e.touches[1].clientX,
         e.touches[0].clientY - e.touches[1].clientY
       );
       setPinchDist(d);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchDist) {
        e.preventDefault();
        const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = d / pinchDist;
        const newScale = Math.min(Math.max(0.1, view.scale * ratio), 5);
        setView(v => ({ ...v, scale: newScale }));
        setPinchDist(d);
    }
  };
  
  const handleTouchEnd = () => {
    setPinchDist(null);
  };

  useEffect(() => {
    // Prevent default browser zoom actions
    const preventDefault = (e) => e.preventDefault();
    const container = containerRef.current;
    
    if (container) {
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        // We also want to prevent ctrl+wheel browser zoom, handled in onWheel but explicit here safer
        container.addEventListener('wheel', (e) => { if(e.ctrlKey) e.preventDefault(); }, { passive: false });
    }

    const handleKeyDown = (e) => {
      if (editingId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if(container) {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('wheel', preventDefault);
        }
    };
  }, [selectedId, selectionType, nodes, edges, editingId, pinchDist, view.scale]);

  const selectedNode = selectedId && selectionType === 'node' ? nodes.find(n => n.id === selectedId) : null;
  const selectedEdge = selectedId && selectionType === 'edge' ? edges.find(e => e.id === selectedId) : null;

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden font-sans text-slate-800 select-none">
      
      {/* TOOLBAR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-slate-200 p-1.5 rounded-2xl shadow-xl print:hidden">
        <div className="flex gap-1">
          <button onClick={() => { setMode('select'); setConnectingSource(null); }} className={`p-2 rounded-lg ${mode === 'select' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-500'}`} title="Select (V)"><MousePointer2 size={18} /></button>
          <button onClick={() => setMode('pan')} className={`p-2 rounded-lg ${mode === 'pan' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-500'}`} title="Pan (Space)"><Hand size={18} /></button>
          <button onClick={() => { setMode('connect'); setConnectingSource(null); }} className={`p-2 rounded-lg ${mode === 'connect' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-slate-100 text-slate-500'}`} title="Connect (C)"><Zap size={18} /></button>
        </div>
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <button onClick={() => { setMode(mode === 'presentation' ? 'select' : 'presentation'); setSelectedId(null); setSelectionType(null); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${mode === 'presentation' ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white'}`}>
          {mode === 'presentation' ? <Edit3 size={14}/> : <Play size={14} fill="currentColor" />}
          {mode === 'presentation' ? 'Edit' : 'Present'}
        </button>
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <button onClick={() => setShowLayerPanel(!showLayerPanel)} className={`p-2 rounded-lg ${showLayerPanel ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-500'}`} title="Layers"><List size={18} /></button>
        
        {/* EXPORT TOOLS */}
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <button onClick={handleExportData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Save File (JSON)"><Download size={18} /></button>
        <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Open File (JSON)"><Upload size={18} /></button>
        <button onClick={handleExportPDF} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="Export PDF"><FileText size={18} /></button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportData} className="hidden" />
      </div>

      {/* LEFT SIDEBAR (Edit Mode Only) */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 bg-white/90 backdrop-blur-md border border-slate-200 p-2 rounded-2xl shadow-xl transition-all ${mode === 'presentation' ? '-translate-x-32' : 'translate-x-0'} print:hidden`}>
        <button onClick={() => addNode('container')} className="p-3 hover:bg-blue-50 rounded-xl group relative"><Layers size={24} className="text-slate-600 group-hover:text-blue-600" /></button>
        <button onClick={() => addNode('block')} className="p-3 hover:bg-blue-50 rounded-xl group relative"><Box size={24} className="text-slate-600 group-hover:text-blue-600" /></button>
        <button onClick={() => addNode('text')} className="p-3 hover:bg-blue-50 rounded-xl group relative"><Type size={24} className="text-slate-600 group-hover:text-blue-600" /></button>
        <div className="h-px w-full bg-slate-200 my-1"></div>
        <button onClick={handleRecursiveLayout} className="p-3 hover:bg-slate-100 rounded-xl group relative" title="Clean Up (Auto-Layout)">
          <Grid size={20} className="text-slate-600 group-hover:text-slate-900" />
        </button>
      </div>

      {/* RIGHT SIDEBAR: LAYER PANEL */}
      {showLayerPanel && (
        <div className="absolute right-4 top-20 bottom-20 w-64 bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-xl flex flex-col z-40 animate-in slide-in-from-right-4 duration-300 print:hidden">
           <div className="p-3 border-b border-slate-100 flex justify-between items-center">
              <span className="font-semibold text-slate-700 text-sm">Components</span>
              <button onClick={() => setShowLayerPanel(false)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-2">
              {nodes.filter(n => !n.parentId).map(node => (
                 <TreeItem 
                    key={node.id} 
                    node={node} 
                    allNodes={nodes} 
                    onSelect={selectAndCenterNode} 
                    selectedId={selectedId} 
                 />
              ))}
              {nodes.length === 0 && <div className="text-center text-xs text-slate-400 mt-4">Canvas is empty</div>}
           </div>
        </div>
      )}

      {/* PROPERTY PANEL (Edit Mode) */}
      {selectedId && mode !== 'presentation' && !showLayerPanel && (
        <div className="absolute right-4 top-20 w-72 bg-white/95 backdrop-blur shadow-2xl border border-slate-200 rounded-xl p-4 z-50 print:hidden">
           <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
             <span className="font-semibold text-slate-700 text-sm">
               {selectionType === 'node' ? 'Edit Component' : 'Edit Connection'}
             </span>
             <button onClick={() => { setSelectedId(null); setSelectionType(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"><X size={14}/></button>
           </div>
           
           {selectionType === 'node' && selectedNode && (
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-medium text-slate-500 mb-1">
                    {selectedNode.type === 'text' ? 'Content' : 'Name'}
                 </label>
                 {selectedNode.type === 'text' ? (
                    <textarea 
                        rows={4}
                        value={selectedNode.label}
                        onChange={(e) => updateNodeProperty(selectedId, { label: e.target.value })}
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 ) : (
                    <input 
                        type="text" 
                        value={selectedNode.label}
                        onChange={(e) => updateNodeProperty(selectedId, { label: e.target.value })}
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 )}
               </div>
               
               {/* Container Specific Properties */}
               {selectedNode.type === 'container' && (
                  <div className="flex items-center justify-between py-2 border-y border-slate-100">
                     <span className="text-xs font-medium text-slate-600 flex items-center gap-2">
                        {selectedNode.locked ? <Lock size={12}/> : <Unlock size={12}/>}
                        Lock Layout
                     </span>
                     <button 
                        onClick={() => updateNodeProperty(selectedId, { locked: !selectedNode.locked })}
                        className={`w-10 h-5 rounded-full relative transition-colors ${selectedNode.locked ? 'bg-blue-500' : 'bg-slate-200'}`}
                     >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedNode.locked ? 'translate-x-5' : 'translate-x-0'}`} />
                     </button>
                  </div>
               )}

               {selectedNode.type !== 'text' && (
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                    <textarea 
                    rows={3}
                    value={selectedNode.description || ''}
                    onChange={(e) => updateNodeProperty(selectedId, { description: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Add a description..."
                    />
                </div>
               )}

               <div className="grid grid-cols-2 gap-2">
                  <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
                     <input type="number" value={selectedNode.width} onChange={(e) => updateNodeProperty(selectedId, { width: parseInt(e.target.value) || 0 })} onKeyDown={(e) => e.stopPropagation()} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">Height</label>
                     <input type="number" value={selectedNode.height} onChange={(e) => updateNodeProperty(selectedId, { height: parseInt(e.target.value) || 0 })} onKeyDown={(e) => e.stopPropagation()} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  </div>
               </div>
             </div>
           )}

           {selectionType === 'edge' && selectedEdge && (
             <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                    <input 
                        type="text" 
                        value={selectedEdge.label || ''}
                        onChange={(e) => updateEdgeStyle({ label: e.target.value })}
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Add text..."
                    />
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-2">Line Style</label>
                   <div className="flex gap-2">
                      <button onClick={() => updateEdgeStyle({style: 'solid'})} className={`flex-1 py-1.5 text-xs border rounded ${selectedEdge.style === 'solid' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`}>Solid</button>
                      <button onClick={() => updateEdgeStyle({style: 'dashed'})} className={`flex-1 py-1.5 text-xs border rounded ${selectedEdge.style === 'dashed' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`}>Dashed</button>
                      <button onClick={() => updateEdgeStyle({style: 'dotted'})} className={`flex-1 py-1.5 text-xs border rounded ${selectedEdge.style === 'dotted' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`}>Dotted</button>
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-2">Direction</label>
                   <div className="flex gap-2">
                      <button onClick={() => updateEdgeStyle({arrow: 'none'})} className={`flex-1 py-1.5 border rounded flex justify-center ${selectedEdge.arrow === 'none' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`} title="None"><Minus size={14}/></button>
                      <button onClick={() => updateEdgeStyle({arrow: 'end'})} className={`flex-1 py-1.5 border rounded flex justify-center ${selectedEdge.arrow === 'end' || !selectedEdge.arrow ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`} title="End"><MoveRight size={14}/></button>
                      <button onClick={() => updateEdgeStyle({arrow: 'start'})} className={`flex-1 py-1.5 border rounded flex justify-center ${selectedEdge.arrow === 'start' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`} title="Start"><MoveLeft size={14}/></button>
                      <button onClick={() => updateEdgeStyle({arrow: 'both'})} className={`flex-1 py-1.5 border rounded flex justify-center ${selectedEdge.arrow === 'both' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500'}`} title="Both"><MoveHorizontal size={14}/></button>
                   </div>
                </div>
             </div>
           )}

           <button 
              onClick={deleteSelection}
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
           >
             <Trash2 size={14} /> {selectionType === 'node' ? 'Delete Node' : 'Delete Connection'}
           </button>
        </div>
      )}

      {/* CANVAS */}
      <div 
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden transition-colors duration-300 ${mode === 'pan' || panning ? 'cursor-grabbing' : mode === 'connect' ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ backgroundColor: mode === 'presentation' ? '#f8fafc' : '#f1f5f9', touchAction: 'none' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`, backgroundPosition: `${view.x}px ${view.y}px` }} />

        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0', width: '100%', height: '100%' }} className="relative w-full h-full">
          
          {nodes.filter(n => !n.parentId).map(node => (
              <NodeComponent 
                key={node.id} 
                node={node} 
                allNodes={nodes}
                onDragStart={handleNodeDragStart}
                onResizeStart={handleResizeStart}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setSelectionType('node'); }}
                isPresentation={mode === 'presentation'}
                isConnectMode={mode === 'connect'}
                connectingSourceId={connectingSource}
                onConnectClick={handleConnectClick}
                editingId={editingId}
                setEditingId={setEditingId}
                onUpdateLabel={(id, newLabel) => setNodes(nodes.map(n => n.id === id ? { ...n, label: newLabel } : n))}
              />
            ))
          }

          <ConnectionLayer 
            nodes={nodes} 
            edges={edges} 
            selectedEdgeId={selectionType === 'edge' ? selectedId : null}
            onSelectEdge={(id) => { if (mode !== 'presentation') { setSelectedId(id); setSelectionType('edge'); } }}
          />

        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-xl shadow-lg print:hidden">
         <button onClick={() => setView(v => ({...v, scale: Math.max(0.1, v.scale - 0.1)}))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Minimize size={18} /></button>
         <span className="text-xs font-mono font-medium text-slate-600 w-12 text-center">{Math.round(view.scale * 100)}%</span>
         <button onClick={() => setView(v => ({...v, scale: Math.min(5, v.scale + 0.1)}))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Maximize size={18} /></button>
      </div>
      
      {/* CONNECT HINT */}
      {mode === 'connect' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-bounce z-50 print:hidden">
           {connectingSource ? 'Click target node' : 'Click starting node'}
        </div>
      )}
    </div>
  );
}