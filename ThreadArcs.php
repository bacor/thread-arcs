<?php
/**
 * Library to draw 'Thread Arcs'
 *
 * Original idea by Bernard Kerr:
 * http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.9825&rep=rep1&type=pdf
 */
 

/**
 * Converts array to html argument="value" style
 *
 * @param array $arr
 * @return str $args
 */
function array_to_html_args($arr) {
	$args = '';
	foreach($arr as $key=>$value) {
		$args .= $key . '="' . $value . '" ';
	}
	return $args;
}


/**
 * Adds and removes things from an array
 *
 * @param array $arr
 * @return arrau $arr modified array
 */
function modify_array($arr, $remove, $add=array()) {
	$arr = array_merge($arr, $add);

	foreach($remove as $key) {
		unset($arr[$key]);
	}
	
	return $arr;
}



/**
 * Point class
 *
 * Shortcut for for example `get_post_author()`, which can now be called as
 * `get('post_author')`.
 *
 * @param string $function name of the function
 * @param mixed $params,... parameters passed to the function
 * @return bool $has
 */
class Point {

	/**
	 * x-position of point
	 */
	public $x;
	
	
	/**
	 * y-position
	 */
	public $y;
	

	/**
	 * Point constructor
	 * 
	 * @param float $y y-postition of the point
	 * @param array $params optional parameters
	 */
	public function __construct($y, $params=[]) {
		$this->y = $y;
		$this->x = (isset($params['x'])) ? $params['x'] : 100;
		
		// Default parameters
		$this->params = array_merge(array(
			'r' => 5,
			'class' => 'point'
		), $params);
	}
	
	
	/**
	 * Get html arguments
	 *
	 * @return string $html 
	 */
	private function get_html_args() {
		$remove = ['x'];
		$add = array(
			'cx' => $this->x,
			'cy' => $this->y
		);
		return modify_array($this->params, $remove, $add);
	}
	
	
	/**
	 * Get an svg object
	 * 
	 * @return string $svg
	 */
	public function get_svg() {
		return "<circle " . array_to_html_args($this->get_html_args()) . "/>";
	}
	
	
	/**
	 * Print svg object
	 */
	public function draw() {
		echo $this->get_svg();
	}
}



/** 
 * Arc class
 */
class Arc {

	/**
	 * Constructor
	 *
	 * @param object $A point A
	 * @param object $B point B 
	 *
	 * #Parameters in the `$params` argument:
	 * @param float max_length maximal length of the arc (relative to other points, possibly)
	 * @param float max_width maximal 'height' of the arc (it is the width, really)
	 * @param int dir direction: positive (1) or negative (-1)
	 * @param float lambda Parameter that influences the relative height of the arcs. Default 1/2.
	 * @param int precision numerial precision.
	 */
	public function __construct($A, $B, $params=[]){
		$this->A = $A;
		$this->B = $B;

		// Default parameters
		$this->params = array_merge(array(
			'class' => 'arc',
			'max_length' => 400,
			'max_width' => 80,
			'precision' => 2, 	// Numerical precision
			'lambda' => 1/2, 	// Parameter for the relative 'height' of arcs, def. to sqrt
			'dir' => 1 			// Direcction: positive (1) or negative (-1)
		), $params);

	}
	
	
	/**
	 * Get the html arguments
	 *
	 * @return string $html
	 */
	private function get_html_args(){
		$remove = array('max_length','max_width','precision','lambda','dir');
		return modify_array($this->params, $remove);
	}
	
	/**
	 * Returns the svg path object corresponding to the arc
	 *
	 * The arc between the two points has a height that depends on the relative 
	 * length of the arc. Relative to the `max_length`, that is. If $r$ is the relative
	 * length, then the height is given by $r^\lambda$ * \text{max_width}$.
	 *
	 * @return string $svg
	 */
	public function get_svg() {
		
		// Shortcuts
		$x = $this->A->x;
		$Ay = $this->A->y;
		$By = $this->B->y;
	
		// Calculate height of the arc
		$r = abs($By - $Ay) / $this->params['max_length']; // Relative arc length (wrt max length)
		$H = pow($r, $this->params['lambda']) * $this->params['max_width'];
		$H = $x + (int) $this->params['dir'] * round($H, $this->params['precision']);

		$path =   'd="M' . $x .' '. $Ay .' '
					.'C' . $H .' '. $Ay .' '
						 . $H .' '. $By .' '
						 . $x .' '. $By .'" ';

		return '<path ' . $path . array_to_html_args($this->get_html_args()) . '/>';
	}
	
	/**
	 * Print the svg object
	 */
	public function draw() {
		echo $this->get_svg();
	}
}



class Article {

	public function __construct($params) {
		
	
	}
}


/**
 * ThreadArcs class
 */
class ThreadArcs {
	
	/**
	 * Array with all Point object
	 */
	public $points = [];
	
	
	/**
	 * Array with all Arc object
	 */
	public $arcs = [];
	
	
	/**
	 * Constructor
	 */
	public function __construct( $nodes, $connList, $params=[] ) {
		
		// Store all settings
		$this->nodes = $nodes;
		$this->connList = $connList;		
		$this->N = count($this->nodes);
		
		$this->params = array_merge(array(
			'vspace' => 30,
			'height' => null,
			'max_width'=> 50
		), $params);
		
		
		// Adjust vspace if height parameter is set
		if(isset($this->params['height'])) {
			$this->params['vspace'] = $this->params['height'] / $this->N;
		}
		$this->height = $this->N * $this->params['vspace'];
		$this->width = 2*$this->params['max_width'];
		
		// Get the longest arc
		$arc_lengths = [];
		foreach($this->connList as $i=>$connections) {
			foreach($connections as $j) {
				$arc_lengths[] = abs($j - $i);
			}
		}
		$this->max_length = max($arc_lengths) * $this->params['vspace'];
		
		
		$this->set_up_elements();
	}
	
	
	/**
	 * Create all points and arcs
	 */
	public function set_up_elements() {
	
		// Draw all nodes
		foreach($this->nodes as $i=>$node) {
			$p = new Point(10 + $i * $this->params['vspace'], array(
						'x' => $this->width / 2,
						'class' => 'point p'.$i
					));
			$this->points[] = $p; // Store, why not?
		}
		
		// Draw all arcs
		// Start from one node. Draw a child with an arc on the right. 
		// Then draw all its children on the left. Draw the next child on the right,
		// all its children on the left, and so on.
		$dir = 1;
		foreach($this->connList as $i => $targets) {
			
			$this->get_arcs_from_point($i, $dir);

			$dir = -1 * $dir;						
			foreach($targets as $j) {
				$this->get_arcs_from_point($j, $dir);
			}
			$dir = -1 * $dir;
		}
	}
	
	/**
	 * Creates all arcs from a certain point
	 */
	function get_arcs_from_point($i, $dir=1) {
		
		foreach( $this->connList[$i] as $j ) {
			
			if( !isset( $this->arcs[$i][$j]) ) {
			
				$p = $this->points[$i];
				$q = $this->points[$j];

				$arc = new Arc($p, $q, array(
							'max_width' => $this->params['max_width'],
							'max_length' => $this->max_length,
							'dir' => $dir,
							'class' => 'arc arc-p' . $i . ' arc-p' . $j
						));
				
				// Store --- why not?
				if( is_array($this->arcs[$i]) ){
					$this->arcs[$i][$j] = $arc;
				} else {
					$this->arcs[$i] = [$arc];
				}
			}
		}
	}
	
	
	/**
	 * Get the SVG string
	 *
	 * @return string $svg
	 */ 
	public function get_svg() {

		$svg = '<svg width="' . $this->width . '" height="' . $this->height .'">';
				
		// Draw all arcs
		foreach($this->arcs as $arcs) { foreach($arcs as $arc) {
			$svg .= $arc->get_svg() . '\n';
		}}
		
		// Draw points after arcs!
		foreach($this->points as $p) {
			$svg .= $p->get_svg() . '\n';
		}
		
		$svg .= '</svg>';
		
		return $svg;
	}
	
	
	/**
	 * Draw this svg image
	 */
	public function draw() {
		echo $this->get_svg();
	}	

}
