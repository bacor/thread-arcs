/**
 * ThreadArcs Class by Bas Cornelissen
 */


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
var ThreadArcs = function(container, nodes, connList, options)  {
	options || (options={})
	
	// Fix binding
	if (!(this instanceof ThreadArcs)) {
		return new ThreadArcs(container, nodes, connList, options);
		
	} else {
		this.container 		 = container
		this.nodes			 = nodes
	    this.connList 		 = connList
	    this.invConnList 	 = invertConnList(connList)
		this.points			 = []
		this.N 				 = nodes.length
		// this.arcs			 = repeat(repeat([], this.N), this.N)
		this.arcs 			 = []
		
		this.space			 = (options['space'] || 40)
		this.maxArcHeight	 = (options['maxArcHeight'] || 100)
		this.padding		 = (options['padding'] || this.space/2)
		this.lambda			 = (options['lambda'] || 1/2)
		this.radius 		 = (options['radius'] || 5)

		this.orientation	= (options['orientation'] || 'horizontal')
		this.axisPos		= (options['axisPos'] || this.maxArcHeight)
		this.width 			= this.space * (this.N - 1) + 2 * this.padding
		this.height 		= (options['size'] || this.maxArcHeight * 2)
		
		this.active 		= []

		if(this.orientation == 'vertical'){	
			this.width 		= this.height
			this.height 	= this.space * (this.N - 1) + 2 * this.padding
		}
		
		// Maximum length
		arcLengths = []
		for(i=0; i<this.N; i++){
			for(j = 0; j < this.connList[i].length; j++) {
				arcLengths.push( Math.abs(this.connList[i][j] - i) )
			}
		}
		this.maxArcLength 	= Math.max.apply(null, arcLengths) * this.space
		
		// Depths and children
		this.depths 		= getDepths(this.invConnList)
		var children 		= [];
		var parents 		= [];
		this.connList.forEach(function(connections, i){
			children.push(connections.length)
			parents.push(this.invConnList[i].length)
		})
		this.children 		= children
		this.parents 		= parents

		// Make paper
		this.paper = new Raphael(
			document.getElementById(this.container), 
			this.width, this.height, 
			0, 0
		);
	}
}

/**
 * Get coordinates from a position
 * @param  {float} pos position
 * @return {array}     coordinates array [x, y]
 */
ThreadArcs.prototype.xy = function(pos) {
	if(this.orientation == 'horizontal') { 
		return [pos, this.axisPos]
	} else {
		return [this.axisPos, pos]
	}
}

/**
 * Draws a point on the paper
 * @param  {float} pos    position of the point
 * @return {object} p     Raphael Element
 */
ThreadArcs.prototype.drawPoint = function(pos) {
	
	xy = this.xy(pos)
	var p = this.paper.circle(xy[0], xy[1], this.radius)
	p.addClass('point p' + (this.points.length + 1))
	p._index = this.points.length + 1
	p._pos = pos
	p._arcsOut = []
	p._arcsIn = []
	p._relDepth = this.N * 2 // just large

	// Hover
	p.hover(function(e, a){
		if(this.active.length > 0) {
			clearTimeout(this.activeTimeout) 
			this.resetHighlighting()	
		}
		this.highlight(p._index - 1)
		
	}.bind(this), function(){
		this.resetHighlighting()
		this.activeTimeout = setTimeout(this.showActive.bind(this), 300)

	}.bind(this))
	
	this.points.push(p)
	return this
}

/**
 * Get the arc (svg path) between two points
 * @param  {float} posA position of point A
 * @param  {float} posB position of point B
 * @param  {int} dir  direction; 1=positive, -1=negative
 * @return {string}      svg path
 */
ThreadArcs.prototype.getArcPath = function(posA, posB, dir) {
	dir || (dir = 1)
	var ax = this.axisPos
	
	var relArcLength = Math.abs(posB - posA) / this.maxArcLength
	var H = Math.pow(relArcLength, this.lambda) * this.maxArcHeight
	H = ax + dir * H
	var d = dir * this.radius / 2 // small offset from point
	
	if(this.orientation == 'vertical') {
		path =	  'M' + (ax+d) +' '+ posA +' '
				+ 'C' + H +' '+ posA +' '
					  + H +' '+ posB +' '
					  + (ax+d) +' '+ posB
	}

	else {
		path =    'M' + posA +' '+ (ax+d) +' '
				+ 'C' + posA +' '+ H +' '
					  + posB +' '+ H +' '
					  + posB +' '+ (ax+d)

	}

	return path
}

/** 
 * Draws an arc between two points
 * @param {int} i index of the first point
 * @param {int} j index of the second point
 * @param {int} dir direction (1=positive, -1=negative)
 * @return {object} this (ThreadArcs object)
 */
ThreadArcs.prototype.drawArc = function(i, j, dir) {
	
	var A = this.points[i]
	var B = this.points[j]
	var	path = this.getArcPath(A._pos, B._pos, dir)
	var arc = this.paper.path(path)

	arc.addClass('arc arc-p' + i +' arc-p' + j)

	arc._from = i
	arc._to = j
	arc._dir = dir
	arc._relDepth = this.N*2
	A._arcsOut.push(arc)
	B._arcsIn.push(arc)
	this.arcs.push(arc)
	return this
}

/** 
 * Draws the entire ThreadArcs thing
 * @return {objec} this (ThreadArcs object)
 */
ThreadArcs.prototype.draw = function() {
	
	// Draw all nodes
	for( i = 0; i < this.N; i++ ){
		this.drawPoint(this.padding + i * this.space, this.nodes[i])
	}

	// Draw all arcs
	for( i = 0; i < this.N; i++ ) {
		for(k = 0; k < this.connList[i].length; k++) {
			var j = this.connList[i][k]
			this.drawArc(i, Math.abs(j), Math.sign(j))
		}
	}
	
	// Move all points to the front
	for( i = 0; i < this.N; i++ ){
		el = this.points[i].node
		el.parentNode.appendChild(el);
	}

	return this
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
	newNodes = []
	for(i=0; i<this.N; i++ ){ newNodes.push(i) }
	depths = this.depths; children = this.children;
	// Sort and return
	newNodes = newNodes.sort(function (i,j) {
		return (depths[i] > depths[j]) 
				|| (depths[i] == depths[j]) 
		 		    && (children[i] < children[j])
	})
	return newNodes
}

/**
 * The sorting function based on 
 * https://www.medien.ifi.lmu.de/lehre/ws1112/iv/uebung/exercise8_slides.pdf
 * @return {array} ordered nodes
 */
ThreadArcs.prototype.getSortedNodes2 = function() {

	newNodes = []
	depths = this.depths
	this.nodes.forEach(function(node, i){
		if(depths[i] == 0){
			newNodes.unshift(i)
		} else {
			newNodes.push(i)
		}
	})
	return newNodes
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
	if(typeof(method) == 'object') {
		sortedNodes = []
		nodes = this.nodes
		method.forEach(function(i){
			sortedNodes.push(nodes[i])
		})

	} else if(method == 1) {
		sortedNodes = this.getSortedNodes1()
	} else {
		sortedNodes = this.getSortedNodes2()
	}
	
	// Update connection list
	sortedConnList = []
	sortedNodes.forEach(function(i, k){
		connections = this.connList[i]
		dir = (this.depths[Math.abs(i)] % 2 - .5) * (2)
		connections = connections.map(function(j){
			return dir * sortedNodes.indexOf(Math.abs(j))
		})
		sortedConnList.push(connections)
	})

	// Update class variables and return
	this.nodes = sortedNodes
	this.connList = sortedConnList
	return this
}

/**
 * Decorate descendents with css classes indicating their depth.
 * @param {int} i     index of node
 * @param {int} depth (only neede for recursion)
 */
ThreadArcs.prototype.addDepthToDescendants = function(i, depth) {
	depth 		|| (depth=0)

	this.points[i]._arcsOut.forEach(function(arc){
		
		// Update css classes 
		// if the depth is lower than the previous rel depth
		if(arc._relDepth > depth) {
			arc.removeClass('depth-'+arc._relDepth)
			arc._relDepth = depth
			arc.addClass('depth-'+arc._relDepth)
	
			var to = this.points[arc._to]
			to.removeClass('depth-'+to._relDepth)
			to._relDepth = depth
			to.addClass('depth-'+to._relDepth)
		}
		
		this.addDepthToDescendants(arc._to, depth + 1)
	}.bind(this))
}

/**
 * Decorate predecessors with css classes indicating their depth,
 * @see  addDepthToDescendants
 * @param {int} i     index of node
 * @param {depth} depth (for recursion only)
 */
ThreadArcs.prototype.addDepthToPredecessors = function(i, depth) {
	depth 		|| (depth = 0)


	this.points[i]._arcsIn.forEach(function(arc){
		// Update css classes 
		// if the depth is lower than the previous rel depth
		if(arc._relDepth > depth) {
			arc.removeClass('depth-m'+arc._relDepth)
			arc._relDepth = depth
			arc.addClass('depth-m'+arc._relDepth)
	
			var from = this.points[arc._from]
			from.removeClass('depth-m'+from._relDepth)
			from._relDepth = depth
			from.addClass('depth-m'+from._relDepth)
		}
		
		this.addDepthToPredecessors(arc._from, depth + 1)
	}.bind(this))
}

/**
 * Highlights a node, its predecessors and descendants
 * @param  {int} i index of the node to highlight
 * @return {object} this (ThreadArcs Object)
 */
ThreadArcs.prototype.highlight = function(i) {
	this.points[i].addClass('highlight')
	this.addDepthToDescendants(i)
	this.addDepthToPredecessors(i)
	return this
};

/**
 * Reset the highlighting (removes the relevant css classes)
 * @return {object} this (ThreadArcs Object)
 */
ThreadArcs.prototype.resetHighlighting = function(){
	this.arcs.forEach(function(arc) {
		arc.removeClass('depth-'+arc._relDepth)
		arc.removeClass('depth-m'+arc._relDepth)
		arc._relDepth = this.N*2
	})

	this.points.forEach(function(p) {
		p.removeClass('highlight')
		p.removeClass('depth-'+p._relDepth)
		p.removeClass('depth-m'+p._relDepth)
		p._relDepth = this.N*2
	})
	return this
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
	this.points[i].removeClass('active')

	// Remove from active elements
	var index = this.active.indexOf(i)
	if (index > -1) {
 	   this.active.splice(index, 1);
	}

	this.resetHighlighting().showActive()
	return this
}


/**
 * Shows all active points
 * @return {object} this (ThreadArcs object)
 */
ThreadArcs.prototype.showActive = function() {
	this.active.forEach(function(i){
		this.activate(i)
	}.bind(this))
	return this
}



/** 
 * EXTEND RAPHAEL
 */


/**
 * Add class to html element
 * @param {string} className
 */
Raphael.el.addClass = function(className) {
	origClass = this.node.getAttribute('class')
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
	origClass = this.node.getAttribute('class')
	this.node.setAttribute('class', origClass.replace(' ' + className, ''))
	return this
};


/**
 * GENERAL FUNCTIONS
 */


/**
 * Revert the direction of the graph described by the invConnList
 * @param  {array} connList connection list
 * @return {array}          inverted connection list
 */
function invertConnList(connList){
	N = connList.length;
	invConnList = []
	for(i=0; i<N; i++) {
		invConnList.push([])
	}

	connList.forEach(function(connections, i){
		connections.forEach(function(j){
			invConnList[Math.abs(j)].push(i)
		}) 
	})

	return invConnList
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
function getPredecessorsDepths(i, depths, invConnList){
	// Only enter recursion if necessary
	if(depths.indexOf(i) == -1) {
		var parentDepths = []
		invConnList[i].forEach(function(j){
			depths = getPredecessorsDepths(j, depths, invConnList)
			parentDepths.push(depths[j])
		})
		if(parentDepths.length == 0) {
			depths[i] = 0
		} else {
			depths[i] = Math.min.apply(null, parentDepths) + 1 
		}
	}
	return depths
}

/**
 * Determines the depth of all points in a directed acyclic graph
 * described by a connection list L. Here L[i] is an inverted list 
 * with the indices of all parents.
 * It returns a list D of depths (i.e. D[i] is the depth of node i)
 * @param  {array} connList connection list
 * @return {array}          depths
 */
function getDepths(invConnList) {
	// var invConnList = invertConnList(connList)
	var depths = []
	for(i=0; i<invConnList.length; i++) { 
		depths.push(undefined)
	}

	while( depths.indexOf(undefined) != -1 ) {
		i = depths.indexOf(undefined)
		depths = getPredecessorsDepths(i, depths, invConnList)
	}
	return depths
}


function repeat(object, N) {
	var repeated = []
	for(i=0; i<N; i++){
		repeated.push(object)
	}
	return repeated
}


//http://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-an-array-based-on-suppl
var range = function(start, stop, step) {
	start || (start = 0)
    var a = [start];
    while (start < stop) {
        start += step || 1;
        a.push(start);
    }
    return a;
};