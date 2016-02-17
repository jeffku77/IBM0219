
function ibm_sir(S, I, R, beta, gamma, to){
    var npop = S + I + R;
    var bn = new DynamicBN();
    bn.addOrgan("Dz", ['S', 'I', 'R']);

    bn.addAttribute("S", [0]);
    bn.addAttribute("I", [1]);
    bn.addAttribute("R", [2]);

    bn.addTransition("Inf", [1], new DExponential(beta/npop));
    bn.addTransition("Rec", [2], new DExponential(gamma));

    bn.addFuture("S", "Inf");
    bn.addFuture("I", "Rec");

    bn.complete();

    var ibmsir = new IndividualBasedModel("SIR", new PopAll(bn));
    ibmsir.Obs.addObsAttribute(bn.AttributeSet["S"]);
    ibmsir.Obs.addObsAttribute(bn.AttributeSet["I"]);
    ibmsir.Obs.addObsAttribute(bn.AttributeSet["R"]);
    ibmsir.Obs.addObsTr(bn.Transitions['Inf']);
    ibmsir.addBehaviour(NetModifier("FOI", bn.AttributeSet['I'], bn.Transitions['Inf']));

    var sim1 = new Simulator(ibmsir); 

    sim1.simulate({S: S, I: I, R: R}, 0, to, 1);

    return {
        Model: bn,
        Output: ibmsir.Obs.TS
    };
}


function ibm_rinc(npop, death, to){
    var bn = new DynamicBN();

    bn.addOrgan("Life", ['Alive', 'Death']);
    bn.addAttribute("Alive", [0]);
    bn.addAttribute("Death", [1]);
    bn.addTransition("Dead", [1], new DExponential(death));
    bn.addFuture("Alive", "Dead");
    bn.complete();

    var ibmri = new IndividualBasedModel("BIR", new PopSep(bn));
    ibmri.Obs.addObsAttribute(bn.AttributeSet["Alive"]);
    ibmri.Obs.addObsTr(bn.Transitions['Dead']);
    ibmri.addBehaviour(Reincarnation("Rei", bn.AttributeSet['Death'], 'Alive'));

    (new Simulator(ibmri)).simulate({'Alive': npop}, 0, to, 1);

    return {
        Model: bn,
        Output: ibmri.Obs.TS
    };
}


function ibm_sg(npop, k, r, death, to){
    var bn = new DynamicBN();

    bn.addOrgan("Life", ['Alive', 'Death']);
    bn.addAttribute("Alive", [0]);
    bn.addAttribute("Death", [1]);
    bn.addTransition("Dead", [1], new DExponential(death));
    bn.addFuture("Alive", "Dead");
    bn.complete();

    var ibmsg = new IndividualBasedModel("BIR", new PopSep(bn));
    ibmsg.Obs.addObsAttribute(bn.AttributeSet["Alive"]);
    ibmsg.addBehaviour(SGrowth("SG", bn.AttributeSet['Death'], 'Alive', k, r));

    (new Simulator(ibmsg)).simulate({'Alive': npop}, 0, to, 1);

    return {
        Model: bn,
        Output: ibmsg.Obs.TS
    };
}


function ibm_screenning(npop, rProg, rTr, rDeaDz, rDea, rBir, sen, to){
    var bn = new DynamicBN();
    bn.addOrgan("Dz", ['S', 'Dz']);
    bn.addOrgan("Treatment", ['No', 'Yes']);
    bn.addOrgan("Life", ['Alive', 'Death']);

    bn.addAttribute("S", [0, 0, 0]);
    bn.addAttribute("D", [1, -1, 0]);
    bn.addAttribute("D_NTr", [1, 0, 0]);
    bn.addAttribute("D_Tr", [1, 1, 0]);
    bn.addAttribute("Alive", [-1, -1, 0]);
    bn.addAttribute("Death", [-1, -1, 1]);

    bn.addTransition("Prog", [1, -1, -1], new DExponential(rProg));
    bn.addTransition("Tr",   [-1, 1, -1], new DExponential(rTr));
    bn.addTransition("DeadDz", [-1, -1, 1], new DExponential(rDeaDz));
    bn.addTransition("Dead", [-1, -1, 1], new DExponential(rDea));

    bn.addFuture("S", "Prog");
    bn.addFuture("D", "DeadDz");
    bn.addFuture("D_NTr", "Tr");
    bn.addFuture("Alive", "Dead");

    bn.complete();

    var ibmscr = new IndividualBasedModel("SIR", new PopSep(bn));
    ibmscr.Obs.addObsAttribute(bn.AttributeSet["S"]);
    ibmscr.Obs.addObsAttribute(bn.AttributeSet["D"]);
    ibmscr.Obs.addObsAttribute(bn.AttributeSet["D_Tr"]);
    ibmscr.Obs.addObsAttribute(bn.AttributeSet["Alive"]);
    ibmscr.addBehaviour(SGrowth("SG", bn.AttributeSet['Death'], 'S', npop, rBir));
    ibmscr.addBehaviour(Scranning("Scranning", bn.Transitions['Prog'], bn.Transitions['Tr'], sen));

    (new Simulator(ibmscr)).simulate({'S': npop}, 0, to, 1);

    return {
        Model: bn,
        Output: ibmscr.Obs.TS
    };
}

function ibm_hwe(npop, fqA, death, to){

    var bn = new DynamicBN();

    bn.addOrgan("Life", ['Alive', 'Death']);
    bn.addAttribute("Alive", [0]);
    bn.addAttribute("Death", [1]);
    bn.addTransition("Dead", [1], new DExponential(death));
    bn.addFuture("Alive", "Dead");
    bn.complete();


    function fillup(info){
        if ("M" in info){ 
            return info; 
        }else if(Math.random() < fqA){
            return {M: true, P:true}; 
        }else{
            return {M: false, P: false};
        }

    }

    var ibmhwe = new IndividualBasedModel("HWE", new PopSep(bn, fillup));
    ibmhwe.Obs.addObsAttribute(bn.AttributeSet["Alive"]);
    ibmhwe.Obs.addSumFun("G_AA", function(ibm){
        var ags = ibm.Pop.Agents, n = 0;
        for (var ag in ags){
            ag = ags[ag];
            n += ((ag.Info.M + ag.Info.P) == 2);
        }
        return n;
    });

    ibmhwe.Obs.addSumFun("G_Aa", function(ibm){
        var ags = ibm.Pop.Agents, n = 0;
        for (var ag in ags){
            ag = ags[ag];
            n += (ag.Info.M + ag.Info.P == 1);
        }
        return n;
    });

    ibmhwe.Obs.addSumFun("G_aa", function(ibm){
        var ags = ibm.Pop.Agents, n = 0;
        for (var ag in ags){
            ag = ags[ag];
            n += ((ag.Info.M + ag.Info.P) == 0);
        }
        return n;
    });

    ibmhwe.addBehaviour(ReincarnationHWE("Rei", bn.AttributeSet['Death'], 'Alive'));

    (new Simulator(ibmhwe)).simulate({'Alive': npop}, 0, to, 1);

    return {
        Model: bn,
        Output: ibmhwe.Obs.TS
    };
}



function simu_sir(){
    var S = +$("#sir #S").val(),
        I = +$("#sir #I").val(),
        R = +$("#sir #R").val(),
        beta = +$("#sir #beta").val(),
        gamma = +$("#sir #gamma").val(),
        to = +$("#rinc #to").val();
    var simu = ibm_sir(S, I, R, beta, gamma, to);
    make_plot(simu, S+I+R, to);
}

function simu_rinc(){
    var npop = +$("#rinc #npop").val(),
        death = +$("#rinc #rDeath").val(),
        to = +$("#rinc #to").val();    
    var simu = ibm_rinc(npop, death, to);
    make_plot(simu, npop, to);
}

function simu_sg(){
    var npop = +$("#sg #npop").val(),
        death = +$("#sg #rDeath").val(),
        k = +$("#sg #k").val(),
        r = +$("#sg #rBir").val(),
        to = +$("#sg #to").val();    
    var simu = ibm_sg(npop, k, r, death, to);
    make_plot(simu, k, to);
}

function simu_screen(){
    var npop = +$("#screen #npop").val(),
        rProg = +$("#screen #rProg").val(),
        rTr = +$("#screen #tr").val(),
        rDeaDz = +$("#screen #rDeathDz").val(),
        rDea = +$("#screen #rDeath").val(),
        rBir = +$("#screen #rBir").val(),
        sen = +$("#screen #sen").val(),
        to = +$("#screen #to").val();
    var simu = ibm_screenning(npop, rProg, rTr, rDeaDz, rDea, rBir, sen, to);
    make_plot(simu, npop, to);
}

function simu_hwe(){
    var npop = +$("#hew #npop").val(),
        fqA = +$("#hew #fqA").val(),
        death = +$("#hew #rDeath").val(),
        to = +$("#hew #to").val();
    var simu = ibm_hwe(npop, fqA, death, to);
    make_plot(simu, npop, to);
}

function make_plot(simu, max, to){ 
    var output = simu.Output;
    var wd = $('#ts').width()*0.95, ht = wd*0.6;
    var margin = {top: 20, right: 80, bottom: 20, left: 70},
        width = wd - margin.left - margin.right,
        height = ht - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]).domain([0, to]);
    var y = d3.scale.linear().range([height, 0]).domain([0, max]);

    var col = d3.scale.category10().domain(d3.keys(output[0]));
    var xAxis = d3.svg.axis().scale(x)
    .orient("bottom").ticks(5);

    var yAxis = d3.svg.axis().scale(y)
    .orient("left").ticks(5);

    var valueline = d3.svg.line()
    .x(function(d) { return x(d.x); })
    .y(function(d) { return y(d.y); });

    $('#ts').empty();
    var svg = d3.select("#ts")
    .append("svg")
    .attr("width", wd)
    .attr("height", ht)
    .append("g")
    .attr("transform", 
          "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")			// Add the X Axis
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
    svg.append("g")			// Add the X Axis
        .attr("class", "y axis")
        .call(yAxis);


    d3.keys(output[0]).forEach(
        function(name){
            var data;
            if (name == 'Time') {return;}
            data = output.map(function(rec){
                return {x: rec.Time, y: rec[name]};
            });    
            data.reverse();
            svg.append("path")		// Add the valueline path.
                .attr("class", "line")
                .style("stroke", col(name))
                .attr("d", valueline(data));
            svg.append("text")
                .attr("transform", "translate("+(width+3)+","+y(output[output.length-1][name])+")")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("fill", col(name))
                .text(name);
        }
    );

}


