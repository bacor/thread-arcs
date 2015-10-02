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
		this.container 	 = container
		this.nodes		 = nodes
	    this.connList 	 = connList
		this.points		 = []
		this.arcs		 = []
		this.defaultNode = {
		 	//...
		}
				
		this.N 				= nodes.length
		this.space			= (options['space'] || 40)
		this.maxArcHeight	= (options['maxArcHeight'] || 100)
		this.padding		= (options['padding'] || this.space/2)
		this.lambda			= (options['lambda'] || 1/2)
		this.radius 		= (options['radius'] || 5)

		this.orientation	= (options['orientation'] || 'horizontal')
		this.axisPos		= (options['axisPos'] || this.maxArcHeight)
		this.width 			= this.space * (this.N - 1) + 2 * this.padding
		this.height 		= (options['size'] || this.maxArcHeight * 2)
		
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
		this.maxArcLength = Math.max.apply(null, arcLengths) * this.space
		
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
	p = this.paper.circle(xy[0], xy[1], this.radius)
	p.addClass('point p' + this.points.length + 1)
	p._index = this.points.length + 1
	p._pos = pos
	p._arcs = []

	// Hover
	p.hover(function(){
		
		// hover all neighbouring arcs
		for(i=0; i < this._arcs.length; i++){
			this._arcs[i].addClass('hover')
			this._arcs[i]._from.addClass('hover')
			this._arcs[i]._to.addClass('hover')
		}
	}, function(){
		for(i=0; i < this._arcs.length; i++){
			this._arcs[i].removeClass('hover')
			this._arcs[i]._from.removeClass('hover')
			this._arcs[i]._to.removeClass('hover')
		}
	})
	
	this.points.push(p)
	return p
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
	ax = this.axisPos
	
	relArcLength = Math.abs(posB - posA) / this.maxArcLength
	H = Math.pow(relArcLength, this.lambda) * this.maxArcHeight
	H = ax + dir * H
	d = dir * this.radius / 2 // small offset from point
	
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
 * ThreadArcs.addArc
 */
ThreadArcs.prototype.drawArc = function(A, B, dir) {
	dir || (dir = 1)
	
	path = this.getArcPath(A._pos, B._pos, dir)
	
	arc = this.paper.path(path)
	arc._index = this.arcs.length + 1
	arc._from = A
	arc._to = B
	arc._dir = dir
	A._arcs.push(arc)
	B._arcs.push(arc)
	arc.addClass('arc a' + arc._index + ' arc-p' + A._index+' arc-p' + B._index)
	
	this.arcs.push(arc)
	return arc
}

/**
 * Draws all arcs from a given point
 */
ThreadArcs.prototype.drawArcsFromPoint = function(i, dir) {
		this.arcs[i] || (this.arcs[i] = [])
		
		for(j = 0; j < this.connList[i].length; j++) {		
			if(!this.arcs[i][j]) {
				A = this.points[i]
				B = this.points[this.connList[i][j]]
				this.drawArc(A, B, dir)
			}
		}
}

/** 
 * Draws the entire ThreadArcs thing
 */
ThreadArcs.prototype.draw = function() {
	
	// Draw all nodes
	for( i = 0; i < this.N; i++ ){
		this.drawPoint(this.padding + i * this.space, this.nodes[i])
	}
		
	// Draw all arcs
	dir = 1
	for( i = 0; i < this.N; i++ ) {
		this.drawArcsFromPoint(i, dir)
		
		dir *= -1
		for( j = 0; j < this.connList[i].length; j++ ){
			this.drawArcsFromPoint(this.connList[i][j], dir)
		}
		dir *= -1
	}
	
	// Move all points to the front
	for( i = 0; i < this.N; i++ ){
		el = this.points[i].node
		el.parentNode.appendChild(el);
	}

}


ThreadArcs.prototype.activatePoint = function(i) {
	p = this.points[i]
	p.addClass('active')
	this.addClassToArcs(i, 'active')
}


ThreadArcs.prototype.addClassToArcs = function(arcs, className) {
	
	// If arcs is a number, treat it as the index of a point
	// and retreive all neighbouring arcs
	if(typeof(arcs) == 'number') {
		arcs = this.points[arcs]._arcs
	}

	for( i = 0; i < arcs.length; i++ ) {
		arcs[i].addClass(className)
	}
}


ThreadArcs.prototype.removeClassFromArcs = function(arcs, className) {
	
	// If arcs is a number, treat it as the index of a point
	// and retreive all neighbouring arcs
	if(typeof(arcs) == 'number') {
		arcs = this.points[arcs]._arcs
	}
	
	for( i = 0; i < arcs.length; i++ ) {
		arcs[i].removeClass(className)
	}
}


/**
 * Expands a point, i.e. moves all lower points and arcs down
 */
ThreadArcs.prototype.expandPoint = function( i, height) {
	
	if(this.points[i]._expanded != true) {
		// Increase canvas height
		this.paper.canvas.setAttribute('height', this.paper.canvas.getAttribute('height') + height);
		
		// Move all points
		for(j = i; j < this.N; j++ ) {
			this.movePoint(j, height)
		}
		
		this.points[i]._expanded = true
	}
}


/**
 * Expands a point, i.e. moves all lower points and arcs down
 */
ThreadArcs.prototype.collapsePoint = function( i, height) {
	
	if(this.points[i]._expanded == true) {

		// Move all points
		for(j = i; j < this.N; j++ ) {
			this.movePoint(j, -height)
		}
		
		this.points[i]._expanded = false
		
		// Decrease canvas height
		this.paper.canvas.setAttribute('height', this.paper.canvas.getAttribute('height') - height);
	}
}


/**
 * Collapses a point --- TO DO 
 */
ThreadArcs.prototype.movePoint = function(A, height){

	if(typeof(A) == 'number') A = this.points[A];
	
	// Move point
	A.animate({'cy': (A.attr('cy')+height)}, 800, 'ease-in-out')
	
	// Move arcs
	for(k = 0; k < A._arcs.length; k++) {
		this.lengthenArc(A._arcs[k], height)
	}
	
}


/**
 * Makes an arc longer; animated
 */
ThreadArcs.prototype.lengthenArc = function(arc, length) {
	path = this.getArcPath(arc._from.attr('cy'), arc._to.attr('cy') + length, arc._dir)
	arc.animate({'path': path}, 800, 'ease-in-out')
}




/**
 * Add class to html element
 * @param {string} className
 */
Raphael.el.addClass = function(className) {
	origClass = this.node.getAttribute('class')
    this.node.setAttribute("class", origClass + ' ' + className);
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



