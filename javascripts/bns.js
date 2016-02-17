function State(des) {
    this.Des = String(des);
}

NullState = new State("Null");

State.prototype.toString = function(){
    return this.Des;
};


function Organ(des) {
    this.Des = des; this.States = new Array();
}

Organ.prototype.addState = function(des){
    this.States.push(new State(des));
};

Organ.prototype.get = function(i){
    var st = this.States[i];
    if (st){
        return st;
    }else{
        return NullState;
    }
};

Organ.prototype.toString = function(){
    return this.Des + " [" + this.States.map(function(d){return d.Des;}).join(", ") + "]";
};


function DExponential(rate){
    this.Rate = rate;
}

DExponential.prototype.sample = function (ag) {
    return - Math.log(Math.random()) / this.Rate;
};

DExponential.prototype.toString = function () {
    return "Exponential(r=" + this.Rate + ")";
};


function Transition(name, atr, dist){
    this.Name = name;
    this.Atr = atr;
    this.Dist = dist;
}

Transition.prototype.rand = function(ag){
    return this.Dist.sample(ag);
};

Transition.prototype.toString = function() {
    return "Transition{" +
        "Name='" + this.Name +
        ", Atr=" + this.Atr.Name +
        ", Dist=" + this.Dist.toString +
        '}';
};


function Attribute(name, orgs){
    this.Name = name;
    this.States = orgs;
    this.Subset = [];
    this.Futures = {};
}

Attribute.prototype.isCompact = function(){
    return this.States.indexOf(NullState) < 0;
}

Attribute.prototype.addTrans = function(trans, atr){
    if (this.isCompact()){
        this.Futures[trans.Name] = {Tr: trans, Atr: atr};
    }
}

Attribute.prototype.addSubset = function(atr){
    if (this.contains(atr)){
        this.Subset.push(atr);
    }
}

Attribute.prototype.isa = function(atr){
    return this.Subset.indexOf(atr) >= 0;
}

Attribute.prototype.fit = function(sts){
    for(var i in this.States){
        if (this.States[i] != sts[i]){
            return false;
        }
    }
    return true;
}

Attribute.prototype.contains = function(atr){
    for(var i in this.States){
        if (this.States[i] != atr.States[i] && atr.States[i] != NullState){
            return false;
        }
    }
    return true;
}

Attribute.prototype.transition = function(trans){
    if (trans.Name in this.Futures){
        return this.Futures[trans.Name].Atr;
    }
    return this;
}

Attribute.prototype.StateSpace = function(){
    var ss = this.Name;
    for (fu in this.Futures){
        ss += "\n-- " + fu + " -> " + this.Futures[fu].Atr.Name;
    }
    return ss;
}


function DynamicBN() {
    this.Organs = [];
    this.AttributeSet = {};
    this.Transitions = {};
    this.Futures = {};
    this.OrgLock = false;
};

DynamicBN.prototype.addOrgan = function(name, sts) {
    if (this.Orglock){return;}
    var org = new Organ(name);
    for (st in sts){
        org.addState(sts[st]);
    }
    this.Organs.push(org);
};

DynamicBN.prototype.addAttribute = function(name, code) {
    this.Orglock = true;
    var sts = [];
    for (i in code){
        sts.push(this.Organs[i].get(code[i]));
    }
    var atr = new Attribute(name, sts);
    this.AttributeSet[name] = atr;

    for (oat in this.AttributeSet){
        oat = this.AttributeSet[oat]
        oat.addSubset(atr);
        atr.addSubset(oat);
    }

    this.Futures[name] = [];
    return atr;
};

DynamicBN.prototype.fit = function(code){
    var sts = [];
    for (i in code){
        sts.push(this.Organs[i].get(code[i]));
    }
    for (atr in this.AttributeSet){
        atr = this.AttributeSet[atr];
        if (atr.fit(sts)){
            return atr;
        }
    }
    var name = "Atr[" + sts.map(function(d){return d.Des;}).join(", ") + "]";
    return this.addAttribute(name, code);    
};

DynamicBN.prototype.addTransition = function(name, code, dist) {
    this.Orglock = true;
    var atr = this.fit(code);
    if (name in this.Transitions) return;
    var tr = new Transition(name, atr, dist);
    this.Transitions[name] = tr;
};

DynamicBN.prototype.addFuture = function(a, t) {
    var tr = this.Transitions[t];
    this.Futures[a].push(tr)
}

DynamicBN.prototype.transition = function(a, t) {
    var sts = [];
    for (i in a.States){
        if (t.Atr.States[i] != NullState){
            sts.push(t.Atr.States[i]);
        }else{
            sts.push(a.States[i]);
        }
    }
    for (atr in this.AttributeSet){
        atr = this.AttributeSet[atr];
        if (atr.fit(sts)){
            return atr;
        }
    }
}

DynamicBN.prototype.complete = function() {
    var bn = this;
    this.product().forEach(function(code){bn.fit(code);})
    var atr, from, to;
    for(fu in this.Futures){
        atr = this.AttributeSet[fu];
        fu = this.Futures[fu];
        for (tr in fu){

            tr = fu[tr];
            for (from in this.AttributeSet){
                from = this.AttributeSet[from];
                if(from.isCompact() & from.isa(atr)){
                    to = this.transition(from, tr);
                    from.addTrans(tr, to);
                }
            }
        }    
    }
};

DynamicBN.prototype.product = function() {
    var Ser = [];
    for (org in this.Organs){
        org = this.Organs[org];
        var s = [];
        for (var i = -1; i < org.States.length; i++) s.push(i);
        Ser.push(s);
    }

    var Pro = [], pop = Ser.shift(), Pro2;
    for (i in pop){
        Pro.push([pop[i]]);
    }
    while (Ser.length >0){
        Pro2 = [];
        pop = Ser.shift(); 
        for (pr in Pro){
            pr = Pro[pr];
            var p;
            for (s in pop){
                p = pr.map(function(d){return d;});
                p.push(pop[s]);
                Pro2.push(p);
            }
        }
        Pro = Pro2;
    }
    return Pro;
};

DynamicBN.prototype.StateSpace = function() {
    var ss ="";
    for (atr in this.AttributeSet){

        atr = this.AttributeSet[atr];
        if (atr.isCompact()){
            ss += atr.StateSpace() + "\n";
        }

    }
    return ss;
};



function NextTr(){
    this.Time = -1;
    this.Tr = undefined;
};

NextTr.prototype.setTr = function(ti, tr){
    this.Time = ti;
    this.Tr = tr;
};

NextTr.prototype.isExist = function(){
    return this.Time != -1;
};

NextTr.prototype.drop = function(){
    return this.Time = -1;
};


function NextAg(){
    this.Time = -1;
    this.Tr = undefined;
    this.Ag = undefined;
};

NextAg.prototype.setAg = function(ti, ag){
    this.Time = ti;
    if (ag){
        this.Tr = ag.next().Tr;
        this.Ag = ag;
    }
};

NextAg.prototype.isExist = function(){
    return this.Time != -1;
};

NextAg.prototype.drop = function(){
    return this.Time = -1;
};


function Modifier(name, target) {
    this.Name = name;
    this.To = 0;
    this.Tar = target;
}

Modifier.prototype.modify = function(tte){
    return tte/this.To;
}

Modifier.prototype.update = function(newVal){
    if (this.To != newVal){
        this.To = newVal;
        return true;
    }else{
        return false;
    }
}

Modifier.prototype.clone = function(){
    return new Modifier(this.Name, this.Tar);
}


function Agent(id, info, attr){
    this.ID = id;
    this.Info = {};
    for (i in info){this.Info[i] = info[i];}
    this.Attr = attr;
    this.Trans = {};
    this.Mods = {};
    this.Next = new NextTr();
};

Agent.prototype.isa = function(attr){
    return this.Attr.isa(attr);
}

Agent.prototype.addModifier = function(mod){
    this.Mods[mod.Name] = mod;
}

Agent.prototype.initialise = function(time) {
    this.Trans = {};
    this.update(time);
    this.dropNext();
}

Agent.prototype.next = function() {
    if(!this.Next.isExist())
        this.findNext();
    return this.Next;
}

Agent.prototype.findNext = function(){
    var tr = null;
    var d = Infinity;
    for (var ct in this.Trans){
        ct = this.Trans[ct];
        if (ct.Time < d){
            d = ct.Time;
            tr = ct.Tr;
        }
    }
    this.Next.setTr(d, tr);
}

Agent.prototype.dropNext = function() {
    this.Next.drop();
}

Agent.prototype.transition = function(tr){
    this.Attr = this.Attr.transition(tr);
    this.dropNext();
}

Agent.prototype.update = function(time){   
    var fus = {};

    var tar;
    for (var mod in this.Mods){
        mod = this.Mods[mod];
        if (mod.Tar.Name in this.Attr.Futures){
            tar = mod.Tar;
            if (!( tar.Name in this.Trans)){
                this.Trans[mod.Tar.Name] = {Tr: tar, Time: mod.modify(tar.rand(this)) + time};
            }
        }
    }

    var tr;
    for (var newfu in this.Attr.Futures){
        tr = this.Attr.Futures[newfu].Tr;
        if (newfu in this.Trans){
            fus[newfu] = this.Trans[newfu];
        }else{
            fus[newfu] = {Tr: tr, Time: tr.rand(this) + time};
        }
    }

    this.Trans = fus;
    this.dropNext();
}

Agent.prototype.shock = function(m, val, time){
    if ( !(m in this.Mods)){ return;}
    var mod = this.Mods[m];
    if (mod.update(val) & (mod.Tar.Name in this.Trans)){
        var tr = mod.Tar;
        this.Trans[mod.Tar.Name] = {Tr: tr, Time: mod.modify(tr.rand(this)) + time};
        this.dropNext();
    }
}


Agent.prototype.info = function(){
    var tn = this.next().Tr.Name;
    var s = "ID: "+ this.ID;
    for (var tr in this.Trans){
        s += "\n" + tr +": "+this.Trans[tr].Time;
        if (tn == tr) s += "*";
    }
    return s;
};


function Breeder(bns, fillup){

    if (fillup){
        this.fillup = fillup;
    }else{
        this.fillup = function(info){return {};};
    }

    this.BNs = bns;
    this.Last = 0;
};

Breeder.prototype.breed = function(atr, info, n){
    n = n||1;

    var ags = [];
    while(ags.length < n){
        this.Last += 1;
        ags.push(new Agent(this.Last, this.fillup(info), this.BNs.AttributeSet[atr]));
    }
    return ags;
};



function PopAll(dbn, fillup, wt) {
    this.Eve = new Breeder(dbn, fillup);
    this.Weight = wt||1;
    this.Agents = {};
};

PopAll.prototype.initialise = function(){
    this.Agents = {};
}

PopAll.prototype.reform = function() {};

PopAll.prototype.neighbours = function(ag){
    return this.Agents;
}

PopAll.prototype.summariseNeighbours = function(ag, atr){
    return this.count(atr) * this.Weight;
}

PopAll.prototype.summarise = function(atr){
    return this.count(atr) * this.Weight;
}

PopAll.prototype.count = function(atr){
    var k = 0;
    for (ag in this.Agents){

        k += this.Agents[ag].isa(atr);
    }
    return k;
}

PopAll.prototype.countNeighbour = function(atr){
    var k = 0;
    for (ag in this.Agents){

        k += this.Agents[ag].isa(atr);
    }
    return k;
}

PopAll.prototype.addAgent = function(atr, info, n){
    var ags = this.Eve.breed(atr, info, n);
    for (ag in ags){
        ag = ags[ag];
        this.Agents[ag.ID] = ag;
    }
    return ags;
}

PopAll.prototype.removeAgent = function(ag){
    delete this.Agents[ag];
}




function PopSep(dbn, fillup, wt) {
    this.Eve = new Breeder(dbn, fillup);
    this.Weight = wt||1;
    this.Agents = {};
};

PopSep.prototype.initialise = function(){
    this.Agents = {};
}

PopSep.prototype.reform = function() {};

PopSep.prototype.neighbours = function(ag){
    return [];
}

PopSep.prototype.summariseNeighbours = function(ag, atr){
    return 0;
}

PopSep.prototype.summarise = function(atr){
    return this.count(atr) * this.Weight;
}

PopSep.prototype.count = function(atr){
    var k = 0;
    for (ag in this.Agents){

        k += this.Agents[ag].isa(atr);
    }
    return k;
}

PopSep.prototype.countNeighbour = function(atr){
    return 0;
}

PopSep.prototype.addAgent = function(atr, info, n){
    var ags = this.Eve.breed(atr, info, n);
    for (ag in ags){
        ag = ags[ag];
        this.Agents[ag.ID] = ag;
    }
    return ags;
}

PopSep.prototype.removeAgent = function(ag){
    delete this.Agents[ag];
}


function ObsIBM(){
    this.Attrs = [];
    this.Trans = [];
    this.SumFun = {};
    this.TS = []
    this.Recs = [];
}

ObsIBM.prototype.renew = function(){
    this.TS = []
    this.Recs = [];
}

ObsIBM.prototype.addObsAttribute = function(atr){
    this.Attrs.push(atr);
}

ObsIBM.prototype.addObsTr = function(tr){
    this.Trans.push(tr.Name);
}

ObsIBM.prototype.addSumFun = function(name, fun){
    this.SumFun[name] = fun;
}

ObsIBM.prototype.observe = function(ibm, time){
    var data = {Time: time}
    for (var atr in this.Attrs) {
        atr = this.Attrs[atr];
        data[atr.Name] = ibm.Pop.summarise(atr);
    }

    for (var tr in this.Trans){
        data[this.Trans[tr]] = 0;
    }

    var po;
    while(this.Recs.length > 0){
        po = this.Recs.shift();
        data[po.Tr] ++;
    } 
    
    for (var fun in this.SumFun){
        data[fun] = this.SumFun[fun](ibm);
    }
    
    this.TS.push(data);
}

ObsIBM.prototype.record = function(nxt){
    if(this.Trans.indexOf(nxt.Tr.Name) >= 0){
        this.Recs.push({Ag: nxt.Ag.ID, Tr: nxt.Tr.Name, Time: nxt.Time});
    } 
}


ObsIBM.prototype.print = function(){
    console.log(this.TS);
}


function IndividualBasedModel(modelType, pop) {
    this.ModelType = modelType;
    this.Obs = new ObsIBM();
    this.Pop = pop;
    this.Behaviours = {};
    this.Next = new NextAg();
};


IndividualBasedModel.prototype.addBehaviour = function(be){
    this.Behaviours[be.Name] = be;
};

IndividualBasedModel.prototype.beChildOf = function(model, listen, par) {
    //todo
};

IndividualBasedModel.prototype.initialise = function(y0, start) {
    this.Pop.initialise();
    var ags;
    for(atr in y0){
        ags = this.Pop.addAgent(atr, {}, y0[atr]);
        for (var ag in ags){
            ag = ags[ag];

            for (var be in this.Behaviours){
                this.Behaviours[be].register(ag);
            }

        }
    }
    for (var be in this.Behaviours){
        this.Behaviours[be].initialise(this, start);
    }
    ags = this.Pop.Agents;
    for (ag in ags){
        ags[ag].initialise(start);
    }
    this.Pop.reform();
    this.Next.drop();
};



IndividualBasedModel.prototype.birth = function(info, atr, n, time){
    var ags = this.Pop.addAgent(atr, info, n);

    for (var ag in ags){
        ag = ags[ag];

        for (var be in this.Behaviours){
            this.Behaviours[be].register(ag);
        }
        ag.initialise(time);
        for (var be in this.Behaviours){
            this.Behaviours[be].impulseIn(this, ag, time);
        }
    }

    this.Next.drop();
};

IndividualBasedModel.prototype.kill = function(id, time){
    var ag = this.Pop.Agents[id];
    for (var be in this.Behaviours){
        this.Behaviours[be].impulseOut(this, ag, time);
    }

    this.Pop.removeAgent(id);
    this.Next.drop();
}

IndividualBasedModel.prototype.observe = function(t) {
    this.Obs.observe(this, t);
}

IndividualBasedModel.prototype.next = function() {
    if(!this.Next.isExist())
        this.findNext();
    return this.Next;
}

IndividualBasedModel.prototype.findNext = function(){
    var ag = null;
    var d = Infinity;
    for (var ct in this.Pop.Agents){
        ct = this.Pop.Agents[ct];
        if (ct.next().Time < d){
            d = ct.Next.Time;
            ag = ct;
        }
    }
    this.Next.setAg(d, ag);
};

IndividualBasedModel.prototype.dropNext = function() {
    this.Next.drop();
};

IndividualBasedModel.prototype.impulseForeign = function(fore, time) {

};

IndividualBasedModel.prototype.impulseTime = function(time) {
    var right = false;

    for (var be in this.Behaviours){
        right = right||this.Behaviours[be].impulseTime(this, time);
    }

    if (right){
        this.Next.drop();
    }
    return right;
};

IndividualBasedModel.prototype.impulseTr = function(ag, tr, time){
    for (var be in this.Behaviours){
        this.Behaviours[be].impulseTr(this, ag, tr, time);
    }
    return true;
};

IndividualBasedModel.prototype.act = function(t) {
    var ag = this.Next.Ag, tr = this.Next.Tr;
    this.Obs.record(this.Next);

    this.impulseTr(ag, tr, t);
    ag.transition(tr);
    ag.update(t);
    this.dropNext();
};


function Simulator(mod) {
    this.Model = mod;
    this.Time = 0;
};

Simulator.prototype.simulate = function(y0, from, to, dt){
    this.Time = from;
    this.Model.initialise(y0, from);
    console.log("Initialised");
    this.Model.observe(from);

    this.update(to, dt);
    console.log("Simulation Complete");
};

Simulator.prototype.update = function(forward, dt){
    var to;
    while (this.Time < forward) {
        to = Math.min(forward, this.Time +dt);
        this.step(to);
    }
}

Simulator.prototype.step = function(to){
    var tx = this.Time, nxt;

    this.Model.impulseTime(tx);
    while (true) {
        nxt = this.Model.next();
        if (nxt.Time > to) break;

        tx = nxt.Time;
        this.Model.act(tx);
    }
    this.Model.observe(to);
    this.Time = to;
}


function Trigger(){};

Trigger.prototype.checkTr = function(ag, tr){return false;};
Trigger.prototype.checkIn = function(ag){return false;};
Trigger.prototype.checkOut = function(ag){return false;};
Trigger.prototype.checkForeign = function(fore){return false;};
Trigger.prototype.checkTime = function(){return false;};

function TimeTrigger(){};
TimeTrigger.prototype = new Trigger();
TimeTrigger.prototype.checkTime = function(){return true;};


function AttributesTrigger(info){ this.Attr = info['Attr'];};
AttributesTrigger.prototype = new Trigger();
AttributesTrigger.prototype.checkTr = function(ag, tr){
    return ag.Attr.transition(tr).isa(this.Attr) ^ ag.Attr.isa(this.Attr);
};

AttributesTrigger.prototype.checkIn = function(ag){ return ag.Attr.isa(this.Attr);};
AttributesTrigger.prototype.checkOut = function(ag){ return ag.Attr.isa(this.Attr);};


function TransitionTrigger(info){ this.Tr = info['Trans'];};
TransitionTrigger.prototype = new Trigger();
TransitionTrigger.prototype.checkTr = function(ag, tr){ return this.Tr == tr;};


function ForeignTrigger(info){ this.Name = info['Model'];};

ForeignTrigger.prototype = new Trigger();
ForeignTrigger.prototype.checkForeign = function(fore){ return this.Name == fore.ID;};

function TimeAttributesTrigger(info){ this.Attr = info['Attr'];};
TimeAttributesTrigger.prototype = new Trigger();
TimeAttributesTrigger.prototype.checkTr = function(ag, tr){
    return ag.Attr.transition(tr).isa(this.Attr) ^ ag.Attr.isa(this.Attr);
};
TimeAttributesTrigger.prototype.checkTime = function(){return true;};


Triggers = {};
Triggers['Time'] = TimeTrigger;
Triggers['Transition'] = TransitionTrigger;
Triggers['Attributes'] = AttributesTrigger;
Triggers['Foreign'] = ForeignTrigger;
Triggers['TimeAttributes'] = TimeAttributesTrigger;

function makeTrigger(info){
    return new Triggers[info['Type']](info);
}


function Action(){};

Action.prototype.initialise = function(ibm, ti){};
Action.prototype.register = function(ag, ti){};
Action.prototype.checkTr = function(ag, ibm, ti){};
Action.prototype.checkIn = function(ag, ibm, ti){};
Action.prototype.checkOut = function(ag, ibm, ti){};
Action.prototype.checkForeign = function(ibm, model, ti){};
Action.prototype.checkTime = function(ibm, ti){};


function ModifyAction(info){
    this.Name = info['Name'];
    this.Prototype = new Modifier(info['Name'], info['Tr']);
    this.Attr = info['Attr'];
}

ModifyAction.prototype = new Action();
ModifyAction.prototype.initialise = function(ibm, ti) {
    var net = ibm.Pop;
    for (var ag in net.Agents){
        this.shock(net, net.Agents[ag], ti);
    }
}

ModifyAction.prototype.register = function(ag, val) {
    ag.addModifier(this.Prototype.clone());
}

ModifyAction.prototype.shockTr = function(ag, ibm, ti) {
    var net = ibm.Pop, neis = net.neighbours(ag);
    this.shock(net, ag, ti);
    for (var nei in neis){
        this.shock(net, neis[nei], ti);
    }
}

ModifyAction.prototype.shockIn = function(ag, ibm, ti) {
    this.shockTr(ag, ibm, ti);
}

ModifyAction.prototype.shockOut = function(ag, ibm, ti) {
    var net = ibm.Pop, neis = net.neighbours(ag);
    for (var nei in neis){
        this.shock(net, neis[nei], ti);
    }
}

ModifyAction.prototype.shock = function(net, ag, ti){
    var val = net.summariseNeighbours(ag, this.Attr);
    ag.shock(this.Name, val, ti);
}


function ScranningAction(info){
    this.Name = info['Name'];
    this.Prototype = new Modifier(info['Name'], info['Cure']);
    this.Sen = info['Sen'];
}

ScranningAction.prototype = new Action();
ScranningAction.prototype.initialise = function(ibm, ti) {
    var net = ibm.Pop;
    for (var ag in net.Agents){
        this.scranning(net.Agents[ag], ti);
    }
}

ScranningAction.prototype.register = function(ag, val) {
    ag.addModifier(this.Prototype.clone());
}

ScranningAction.prototype.shockTr = function(ag, ibm, ti) {
    this.scranning(ag, ti);
}

ScranningAction.prototype.scranning = function(ag, ti){
    var val = +(Math.random() < this.Sen);
    ag.shock(this.Name, val, ti);
}


function ConstBirth(info){
    this.Name = info['Name'];
    this.Bir = info['Bir'];
}

ConstBirth.prototype = new Action();
ConstBirth.prototype.shockTr = function(ag, ibm, ti) {
    ibm.kill(ag.ID, ti);
    ibm.birth({}, this.Bir, 1, ti);
}


function SBirth(info){
    this.Name = info['Name'];
    this.Bir = info['Bir'];
    this.K = info['K'];
    this.R = info['RateBir'];
}

SBirth.prototype = new Action();
SBirth.prototype.shockTr = function(ag, ibm, ti) {
    ibm.kill(ag.ID, ti);
}

SBirth.prototype.shockTime = function(ibm, ti) {
    var n = this.nb(Object.keys(ibm.Pop.Agents).length);

    ibm.birth({}, this.Bir, n, ti);

}

SBirth.prototype.nb = function(n) {
    if (this.K == n) return 0;

    var rate = this.R * (1 - n/this.K);

    rate = 1- Math.exp(-rate);
    var k = 0;
    while(n > 0){
        k += Math.random() < rate;
        n --;
    }
    
    return k;
}



function ConstHWBirth(info){
    this.Name = info['Name'];
    this.Bir = info['Bir'];
};

ConstHWBirth.prototype = new Action();
ConstHWBirth.prototype.shockTr = function(ag, ibm, ti) {
    ibm.kill(ag.ID, ti);
    var gen = this.findParents(ibm);

    gen = {
        P: gen.P.Info[(Math.random()<0.5)?"M":"P"],
        M: gen.M.Info[(Math.random()<0.5)?"M":"P"]
    };
    ibm.birth(gen, this.Bir, 1, ti);
};

ConstHWBirth.prototype.findParents = function(ibm){
    var ags = ibm.Pop.Agents, agks = Object.keys(ags);
    var j1 = Math.floor( Math.random() * (agks.length-1)), j2 = j1;
    while(j2 == j1){
        j2 = Math.floor( Math.random() * (agks.length-1));
    }
    return {M: ags[agks[j1]], P: ags[agks[j2]]};
}


Actions = {};
Actions['Modifier'] = ModifyAction;
Actions['Scranning'] = ScranningAction;
Actions['ConstBirth'] = ConstBirth;
Actions['ConstHWBirth'] = ConstHWBirth;
Actions['SBirth'] = SBirth;


function makeAction(info){
    return new Actions[info['Type']](info);
}


function Behaviour(info) {
    this.Name = info['Name'];
    this.Trigger = makeTrigger(info['Trigger']);
    this.Act = makeAction(info['Action']);
}


Behaviour.prototype.initialise = function(ibm, ti){
    this.Act.initialise(ibm, ti);
}

Behaviour.prototype.register = function(ag, ti){
    this.Act.register(ag, ti);
}

Behaviour.prototype.impulseTr = function(ibm, ag, tr, ti) {
    if (this.Trigger.checkTr(ag, tr)){
        this.Act.shockTr(ag, ibm, ti);
        return true;
    }
    return false;
}

Behaviour.prototype.impulseIn = function(ibm, ag, tr, ti) {
    if (this.Trigger.checkIn(ag)){
        this.Act.shockIn(ag, ibm, ti);
        return true;
    }
    return false;
}


Behaviour.prototype.impulseOut = function(ibm, ag, tr, ti) {
    if (this.Trigger.checkOut(ag)){
        this.Act.shockOut(ag, abm, ti);
        return true;
    }
    return false;
}

Behaviour.prototype.impulseTime = function(ibm, ti) {
    if (this.Trigger.checkTime()) {
        this.Act.shockTime(ibm, ti);
        return true;
    }
    return false;
}

Behaviour.prototype.impulseForeign = function(ibm, model, ti) {
    if (Trigger.checkForeign(model)){
        Act.shockForeign(ibm, model, ti);
        return true;
    }
    return false;
}


Reincarnation = function(name, atr, bir) {
    return new Behaviour({
        Name: name,
        Trigger: {
            Type: "Attributes",
            Attr: atr
        },
        Action: {
            Type: "ConstBirth",
            Bir: bir
        }
    });
}


NetModifier = function(name, atr, tr) {
    return new Behaviour({
        Name: name,
        Trigger: {
            Type: "Attributes",
            Attr: atr
        },
        Action: {
            Name: name,
            Type: "Modifier",
            Attr: atr,
            Tr: tr
        }
    });
}


SGrowth = function(name, atr, bir, k, r) {
    return new Behaviour({
        Name: name,
        Trigger: {
            Type: "TimeAttributes",
            Attr: atr
        },
        Action: {
            Name: name,
            Type: "SBirth",
            Bir: bir,
            K: k,
            RateBir: r
        }
    });
}


ReincarnationHWE = function(name, atr, bir) {
    return new Behaviour({
        Name: name,
        Trigger: {
            Type: "Attributes",
            Attr: atr
        },
        Action: {
            Type: "ConstHWBirth",
            Bir: bir
        }
    });
}


Scranning = function(name, prog, cure, sen) {
    return new Behaviour({
        Name: name,
        Trigger: {
            Type: "Transition",
            Tr: prog
        },
        Action: {
            Type: "Scranning",
            Name: name,
            Cure: cure,
            Sen: sen
        }
    });
}



