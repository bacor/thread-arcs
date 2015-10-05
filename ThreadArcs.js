/**
 * ThreadArcs Class by Bas Cornelissen
 */

var ThreadArcCounter = 0;

/**
 * ThreadArcs class
 * 
 * @constructor
 * @this {ThreadArcs}
 * @param {string} container [id of container div]
 * @param {array} nodes [list with nodes]
 * @param {array} connList [list of lists: for every node, the indices of the nodes it links to]
 * @param {array} options
 */
var ThreadArcs = function(container, invConnList, options)  {
	options || (options={});
	
	// Fix binding
	if (!(this instanceof ThreadArcs)) {
		return new ThreadArcs(container, invConnList, options);
		
	} else {
		ThreadArcCounter 	+= 1;
		this.id 			 = ThreadArcCounter;

		this.container 		 = container;
		this.addClass(document.getElementById(container), 'ThreadArcsContainer');
	    this.invConnList 	 = invConnList;
	    this.connList 	 	 = this.invertConnList(invConnList);
	    this.N 				 = this.invConnList.length;
	    this.nodes           = (options['nodes'] || this.range(this.N-1));
		this.nodeIndices     = this.range(this.N-1);
		this.points			 = [];
		this.arcs 			 = [];
		this.active 		 = [];

		this.space			 = (options['space'] || 40);
		this.maxArcHeight	 = (options['maxArcHeight'] || 100);
		this.padding		 = (options['padding'] || this.space/2);
		this.lambda			 = (options['lambda'] || 1/2);
		this.radius 		 = (options['radius'] || 5);
		this.axisPos		 = (options['axisPos'] || this.maxArcHeight);
		this.width 			 = this.space * (this.N - 1) + 2 * this.padding;
		this.height 	 	 = (options['size'] || this.maxArcHeight * 2);
		
		this.orientation	 = (options['orientation'] || 'horizontal');
		if(this.orientation == 'vertical'){	
			this.width 		= this.height;
			this.height 	= this.space * (this.N - 1) + 2 * this.padding;
		}
		if(this.orientation == 'vertical'){
			this.addClass(document.getElementById(this.container), 'vertical');
		} else {
			this.addClass(document.getElementById(this.container), 'horizontal');
		}

		// Tooltip
		this.disableTooltip	 = (options['disableTooltip'] || false);
		
		// Maximum length
		arcLengths = []
		for(i=0; i<this.N; i++){
			for(j = 0; j < this.connList[i].length; j++) {
				arcLengths.push( Math.abs(this.connList[i][j] - i) );
			}
		}
		this.maxArcLength 	= Math.max.apply(null, arcLengths) * this.space;
		
		// Depths and children
		this.depths 		= this.getDepths(this.invConnList);

		// Make paper
		this.paper = new Raphael(
			document.getElementById(this.container), 
			this.width, this.height, 0, 0);
	}
}

/**
 * Revert the direction of the graph described by the invConnList
 * @param  {array} connList connection list
 * @return {array}          inverted connection list
 */
ThreadArcs.prototype.invertConnList = function(connList){
	N = connList.length;
	invConnList = [];
	for(i=0; i<N; i++) {
		invConnList.push([]);
	}

	connList.forEach(function(connections, i){
		connections.forEach(function(j){
			invConnList[Math.abs(j)].push(i);
		}) 
	})

	return invConnList;
}

/**
 * Recursively determines the depth of all ancestors of a given node
 * in a directed acylic graph. The graph should be described by an
 * inverted connection list L. That means that L[i] is a list of all
 * _parent_ nodes of i.
 * @param  {int} i         	   starting node
 * @param  {array} depths      array of depths will be updated 
 * @param  {array} invConnList inverted connection list
 * @return {array}             array of updated weights
 */
ThreadArcs.prototype.getPredecessorsDepths = function(i, depths, invConnList){
	// Only enter recursion if necessary
	if(depths.indexOf(i) == -1) {
		var parentDepths = [];
		invConnList[i].forEach(function(j){
			depths = this.getPredecessorsDepths(j, depths, invConnList);
			parentDepths.push(depths[j]);
		}.bind(this));
		if(parentDepths.length == 0) {
			depths[i] = 0;
		} else {
			depths[i] = Math.min.apply(null, parentDepths) + 1;
		}
	}
	return depths;
}

/**
 * Determines the depth of all points in a directed acyclic graph
 * described by a connection list L. Here L[i] is an inverted list 
 * with the indices of all parents.
 * It returns a list D of depths (i.e. D[i] is the depth of node i)
 * @param  {array} connList connection list
 * @return {array}          depths
 */
ThreadArcs.prototype.getDepths = function(invConnList) {
	var depths = []
	for(i=0; i<invConnList.length; i++) { 
		depths.push(undefined);
	}

	while( depths.indexOf(undefined) != -1 ) {
		i = depths.indexOf(undefined);
		depths = this.getPredecessorsDepths(i, depths, invConnList);
	}
	return depths;
}


/**
 * Get coordinates from a position
 * @param  {float} pos position
 * @return {array}     coordinates array [x, y]
 */
ThreadArcs.prototype.xy = function(pos) {
	if(this.orientation == 'horizontal') { 
		return [pos, this.axisPos];
	} else {
		return [this.axisPos, pos];
	}
}

/**
 * Draws a point on the paper
 * @param  {float} pos    position of the point
 * @return {object} p     Raphael Element
 */
ThreadArcs.prototype.drawPoint = function(pos) {
	
	xy = this.xy(pos);
	var p = this.paper.circle(xy[0], xy[1], this.radius);
	p.addClass('point p' + (this.points.length + 1));
	p._pos = pos;
	p._arcsOut = [];
	p._arcsIn = [];
	p._relDepth = this.N * 2; // just large

	// Hover
	p.hover(function(e, a){
		if(this.active.length > 0) {
			clearTimeout(this.activeTimeout);
			this.resetHighlighting();
		}
		this.highlight(this.points.indexOf(p));
		this.showTooltip(this.points.indexOf(p));
		
	}.bind(this), function(){
		this.resetHighlighting();
		this.activeTimeout = setTimeout(this.showActive.bind(this), 300);
		this.hideTooltip();
	}.bind(this));
	
	this.points.push(p);
	return this;
}

/**
 * Get the arc (svg path) between two points
 * @param  {float} posA position of point A
 * @param  {float} posB position of point B
 * @param  {int} dir  direction; 1=positive, -1=negative
 * @return {string}      svg path
 */
ThreadArcs.prototype.getArcPath = function(posA, posB, dir) {
	dir || (dir = 1);
	var ax = this.axisPos;
	
	var relArcLength = Math.abs(posB - posA) / this.maxArcLength;
	var H = Math.pow(relArcLength, this.lambda) * this.maxArcHeight;
	H = ax + dir * H;
	var d = dir * this.radius / 2; // small offset from point
	
	if(this.orientation == 'vertical') {
		path =	  'M' + (ax+d) +' '+ posA +' '
				+ 'C' + H +' '+ posA +' '
					  + H +' '+ posB +' '
					  + (ax+d) +' '+ posB;
	}

	else {
		path =    'M' + posA +' '+ (ax+d) +' '
				+ 'C' + posA +' '+ H +' '
					  + posB +' '+ H +' '
					  + posB +' '+ (ax+d);

	}

	return path;
}

/** 
 * Draws an arc between two points
 * @param {int} i index of the first point
 * @param {int} j index of the second point
 * @param {int} dir direction (1=positive, -1=negative)
 * @return {object} this (ThreadArcs object)
 */
ThreadArcs.prototype.drawArc = function(i, j, dir) {
	
	var A = this.points[i];
	var B = this.points[j];
	var	path = this.getArcPath(A._pos, B._pos, dir);
	var arc = this.paper.path(path);

	arc.addClass('arc arc-p' + i +' arc-p' + j);

	arc._from = i;
	arc._to = j;
	arc._dir = dir;
	arc._relDepth = this.N*2;
	A._arcsOut.push(arc);
	B._arcsIn.push(arc);
	this.arcs.push(arc);
	return this;
}

/** 
 * Draws the entire ThreadArcs thing
 * @return {objec} this (ThreadArcs object)
 */
ThreadArcs.prototype.draw = function() {
	
	// Draw all nodes
	for( i = 0; i < this.N; i++ ){
		this.drawPoint(this.padding + i * this.space, this.nodes[i]);
	}

	// Draw all arcs
	for( i = 0; i < this.N; i++ ) {
		for(k = 0; k < this.connList[i].length; k++) {
			var j = this.connList[i][k];
			this.drawArc(i, Math.abs(j), Math.sign(j));
		}
	}

	// Move all points to the front
	for( i = 0; i < this.N; i++ ){
		el = this.points[i].node;
		el.parentNode.appendChild(el);
	}

	return this;
}

/**
 * Sorts the points by generation and then by number of children.
 * More precisely:
 * 		1) older generations come first
 * 		2) those with many children come first
 * @return {[type]} [description]
 */
ThreadArcs.prototype.getSortedNodes1 = function() {
	
	// Initializing
	var indices = this.range(this.N - 1);
	var num_children = this.connList.map(function(i){ return i.length });
	
	// Sort and return
	indices = indices.sort(function (i,j) {
		return (this.depths[i] > this.depths[j])
				|| (this.depths[i] == this.depths[j])
		 		    && (num_children[i] < num_children[j]);
	}.bind(this));

	return indices;
}

/**
 * The sorting function based on 
 * https://www.medien.ifi.lmu.de/lehre/ws1112/iv/uebung/exercise8_slides.pdf
 * @return {array} ordered nodes
 */
ThreadArcs.prototype.getSortedNodes2 = function() {

	indices = [];
	for(i=0; i<this.N; i++) {
		if(this.depths[i] == 0){
			indices.unshift(i);
		} else {
			indices.push(i);
		}
	}

	return indices;
};

/**
 * Sorts the Thread Arcs tree.
 *
 * There are several ways to sort the nodes. First, you can select
 * one of the built-in methods by passing their number as the method.
 *  
 *    - `method=1` 	corresponds is the default sorting
 *    - `method=2` 	is the sorting by De Luca and von Zezschwitz:
 *    				www.medien.ifi.lmu.de/lehre/ws1112/iv/uebung/exercise8_slides.pdf
 *
 * Alternatively, you can pass an array with the new ordering. This
 * should be an array of node-indices, not of the node objects themselves.
 * @param  {mixed} method
 * @return {object} this this
 */
ThreadArcs.prototype.sort = function(method) {
	// Sort
	// should return only the new indices, not the nodes themselves!
	if(typeof(method) == 'object') {
		var sortedNodesIndices = [];
		nodes = this.nodes;
		method.forEach(function(i){
			sortedNodesIndices.push(nodes[i]);
		})

	} else if(method == 1) {
		var sortedNodesIndices = this.getSortedNodes1();
	} else {
		var sortedNodesIndices = this.getSortedNodes2();
	}	

	// Sort the nodes
	var sortedNodes = [];
	sortedNodesIndices.forEach(function(i){
		sortedNodes.push(this.nodes[i]);
	}.bind(this));
	
	// Update connection list
	sortedConnList = [];
	sortedNodesIndices.forEach(function(i){
		connections = this.connList[i];
		dir = (this.depths[Math.abs(i)] % 2 - .5) * (2);
		connections = connections.map(function(j){
			return dir * sortedNodesIndices.indexOf(Math.abs(j));
		})
		sortedConnList.push(connections);
	}.bind(this));

	// Update class variables and return
	// Also store a 'translation' (nodeIndices)
	//  so that we can access nodes by their original ids
	this.nodeIndices 	= sortedNodesIndices;
	this.nodes 			= sortedNodes;
	this.connList 		= sortedConnList;
	this.depths 		= this.getDepths(this.invConnList);
	return this;
}

/**
 * Decorate descendents with css classes indicating their depth.
 * @param {int} i     index of node
 * @param {int} depth (only neede for recursion)
 */
ThreadArcs.prototype.decorateDescendants = function(i, depth) {
	depth 		|| (depth=0);

	this.points[i]._arcsOut.forEach(function(arc){
		
		// Update css classes 
		// if the depth is lower than the previous rel depth
		if(arc._relDepth > depth) {
			arc.removeClass('depth-'+arc._relDepth);
			arc._relDepth = depth;
			arc.addClass('depth-'+arc._relDepth);
	
			var to = this.points[arc._to];
			to.removeClass('depth-'+to._relDepth);
			to._relDepth = depth;
			to.addClass('depth-'+to._relDepth);
		}
		
		this.decorateDescendants(arc._to, depth + 1);
	}.bind(this))
}

/**
 * Decorate predecessors with css classes indicating their depth,
 * @see  addDepthToDescendants
 * @param {int} i     index of node
 * @param {depth} depth (for recursion only)
 */
ThreadArcs.prototype.decoratePredecessors = function(i, depth) {
	depth 		|| (depth = 0);


	this.points[i]._arcsIn.forEach(function(arc){
		// Update css classes 
		// if the depth is lower than the previous rel depth
		if(arc._relDepth > depth) {
			arc.removeClass('depth-m'+arc._relDepth);
			arc._relDepth = depth;
			arc.addClass('depth-m'+arc._relDepth);
	
			var from = this.points[arc._from];
			from.removeClass('depth-m'+from._relDepth);
			from._relDepth = depth;
			from.addClass('depth-m'+from._relDepth);
		}
		
		this.decoratePredecessors(arc._from, depth + 1);
	}.bind(this));
}

/**
 * Highlights a node, its predecessors and descendants
 * @param  {int} i index of the node to highlight
 * @return {object} this (ThreadArcs Object)
 */
ThreadArcs.prototype.highlight = function(i) {
	this.points[i].addClass('highlight');
	this.decorateDescendants(i);
	this.decoratePredecessors(i);
	return this;
};

/**
 * Reset the highlighting (removes the relevant css classes)
 * @return {object} this (ThreadArcs Object)
 */
ThreadArcs.prototype.resetHighlighting = function(){
	this.arcs.forEach(function(arc) {
		arc.removeClass('depth-'+arc._relDepth);
		arc.removeClass('depth-m'+arc._relDepth);
		arc._relDepth = this.N*2;
	})

	this.points.forEach(function(p) {
		p.removeClass('highlight');
		p.removeClass('depth-'+p._relDepth);
		p.removeClass('depth-m'+p._relDepth);
		p._relDepth = this.N*2;
	})
	return this;
}

/**
 * Activates a point
 * @param  {int} i index of point
 * @return {object}   this (ThreadArcs object)
 */
ThreadArcs.prototype.activate = function(i) {
	this.points[i].addClass('active')
	this.highlight(i)

	if(this.active.indexOf(i) == -1) {
		this.active.push(i)
	}
	return this
}


/**
 * Deactivates a point
 * @param  {int} i index of point
 * @return {object}   this (ThreadArcs object)
 */
ThreadArcs.prototype.deactivate = function(i) {
	this.points[i].removeClass('active');

	// Remove from active elements
	var index = this.active.indexOf(i);
	if (index > -1) {
 	   this.active.splice(index, 1);
	}

	this.resetHighlighting().showActive();
	return this;
}


/**
 * Shows all active points
 * @return {object} this (ThreadArcs object)
 */
ThreadArcs.prototype.showActive = function() {
	this.active.forEach(function(i){
		this.activate(i);
	}.bind(this));
	return this;
}


/**
 * Creates the tooltip or returns the object if it exists
 * @return {object} HTML Tooltip element
 */
ThreadArcs.prototype.getTooltip = function() {

	if(this.tooltip == undefined) {
		var tooltip = document.createElement('div');
		tooltip.setAttribute('id', 'ThreadArcsTooltip-'+this.id);
		tooltip.setAttribute('class', 'ThreadArcsTooltip');
		document.getElementById(this.container).appendChild(tooltip);

		// Tooltip content
		var tooltipContent = document.createElement('div');
		tooltipContent.setAttribute('id', 'ThreadArcsTooltipContent-'+this.id);
		tooltipContent.setAttribute('class', 'ThreadArcsTooltipContent');
		tooltip.appendChild(tooltipContent);

		// Tooltip Line
		var tooltipLine = document.createElement('div');
		tooltipLine.setAttribute('id', 'ThreadArcsTooltipLine-'+this.id);
		tooltipLine.setAttribute('class', 'ThreadArcsTooltipLine');
		tooltip.appendChild(tooltipLine);

		this.tooltip = tooltip;

		tooltip.onmouseenter = function(){
			clearTimeout(this.tooltipTimeout);
			clearTimeout(this.tooltipTimeout2);
			clearTimeout(this.activeTimeout);
			var i = parseInt(this.tooltip.getAttribute('data-index'));
			this.activate(i);
		}.bind(this);

		tooltip.onmouseleave = function() {
			this.hideTooltip();
			this.resetHighlighting();
			var i = parseInt(this.tooltip.getAttribute('data-index'));
			this.deactivate(i);
		}.bind(this);
	}

	return this.tooltip;
}

/**
 * Returns the content of the tooltip for a given node.
 * @todo Make it possible to overwrite this method
 * @param  {node} node object, the node
 * @return {string}      The HTML
 */
ThreadArcs.prototype.getTooltipHTML = function(node) {
	return '<a href="' + node['href'] + '" title="' + node['title'] + '">'
			+'<span class="inline-author">' + node['author'] + '.</span> '
			+ '<span class="title">' + node['title'] + '</span>'
	   +'</a>';
}

/**
 * Shows the tooltip corresponding to node i
 * @param  {int} i index of the node
 * @return {object}   this
 */
ThreadArcs.prototype.showTooltip = function(i) {
	if(this.disableTooltip == true) return false;

	// Variables
	var tooltip = this.getTooltip();
	var tooltipLine = document.getElementById('ThreadArcsTooltipLine-'+this.id);
	var tooltipContent = document.getElementById('ThreadArcsTooltipContent-'+this.id);

	// Prevent hiding
	this.removeClass(tooltip, 'hidden');
	clearTimeout(this.tooltipTimeout);
	clearTimeout(this.tooltipTimeout2);

	// Update settings
	var x = this.points[i].attr('cx');
	var y = this.points[i].attr('cy');
	tooltip.setAttribute('data-index', i);
	
	if(this.orientation == 'vertical') {
		tooltip.setAttribute('style', 
			  'left: '+x+'px;'
			+ 'top:'+y+'px;'
			+ 'margin-left:'+this.maxArcHeight+'px;');
		tooltipLine.setAttribute('style', 'width:' + (this.maxArcHeight - this.radius/2) + 'px');
		tooltipContent.innerHTML = this.getTooltipHTML(this.nodes[i]);
	} else {
		tooltipContent.innerHTML = this.getTooltipHTML(this.nodes[i]);
		tooltip.setAttribute('style', 
			  'left: '+x+'px;'
			+ 'top:'+y+'px;'
			+ 'margin-top:'+this.maxArcHeight+'px;');
		tooltipLine.setAttribute('style', 'height:' + (this.maxArcHeight - this.radius/2) + 'px');

	}
	

	return this;
}

/**
 * Hides the tooltip
 * @return {object} this
 */
ThreadArcs.prototype.hideTooltip = function() {
	if(this.disableTooltip == true ) return false;

	this.tooltipTimeout  = setTimeout(function() {
		var s = this.tooltip.getAttribute('style');

		if(s.indexOf('opacity:0;') == -1) {
			this.tooltip.setAttribute('style', s + 'opacity:0;');
		}

		this.tooltipTimeout2 = setTimeout(function() {
			this.addClass(this.tooltip, 'hidden');
		}.bind(this), 600);

	}.bind(this), 600);
	
	return this;
}

/**
 * Simple range function. Retuns the range
 * [start, start+s, ..., stop-s, stop], with s the stepsize.
 * Moreover, range(start) returns range(0, start)
 * @param  {int} start starting value
 * @param  {stop} stop  stop value
 * @param  {step} step  stepsize
 * @return {array}       range
 */
ThreadArcs.prototype.range = function(start, stop, step) {
	if(stop == undefined & step == undefined){
		return this.range(0, start);
	}

	start || (start = 0);
    var a = [start];
    while (start < stop) {
        start += step || 1;
        a.push(start);
    }
    return a;
};

/**
 * Add class to element (HTML element, typically)
 * @param {object} el
 * @param {string} className
 * @return {object} Element
 */
ThreadArcs.prototype.addClass = function(el, className) {
	origClass = el.getAttribute('class');
	if(origClass == null || origClass.indexOf(className) == -1) {
	    el.setAttribute("class", origClass + ' ' + className);
	}
    return el;
}

/**
 * Removes class from an (HTML) element
 * @param  {object} el        
 * @param  {string} className 
 * @return {object}           Element
 */
ThreadArcs.prototype.removeClass = function(el, className) {
	origClass = el.getAttribute('class');
	el.setAttribute('class', origClass.replace(' ' + className, ''));
	return el;
}

/** 
 * EXTEND RAPHAEL
 */


/**
 * Add class to html element
 * @param {string} className
 */
Raphael.el.addClass = function(className) {
	origClass = this.node.getAttribute('class');
	if(origClass == null || origClass.indexOf(className) == -1) {
	    this.node.setAttribute("class", origClass + ' ' + className);
	}
    return this;
};

/**
 * Remove class from html element
 * @param  {string} className
 * @return {object}           element
 */
Raphael.el.removeClass = function(className) {
	origClass = this.node.getAttribute('class');
	this.node.setAttribute('class', origClass.replace(' ' + className, ''));
	return this;
};


function repeat(object, N) {
	var repeated = [];
	for(i=0; i<N; i++){
		repeated.push(object);
	}
	return repeated;
}


/**
 * Do a function n times. The function receives the iteration number 
 * as the first argument. The function is bound to the class.
 * Note that the function is performed N times, so i runs from
 * 0 to N (excluding N)
 * @param  {function} fn   function to apply
 * @param {int} N number of times to apply function (default to this.N)
 * @param  {array}   args optional arguments to pass to the function
 * @return {array}        outputs
 */
ThreadArcs.prototype.doN = function(fn, N, args) {
	args || (args = []);
	N || (N = this.N);
	args.unshift(undefined);

	var result = [];
	for(i=0; i< N; i++) {
		args[0] = i;
		result.push(fn.apply(this, args));
	}
	return result;
}

