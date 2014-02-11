    # -*- coding: utf-8 -*-


# OpenFisca -- A versatile microsimulation software
# By: OpenFisca Team <contact@openfisca.fr>
#
# Copyright (C) 2011, 2012, 2013, 2014 OpenFisca Team
# https://github.com/openfisca
#
# This file is part of OpenFisca.
#
# OpenFisca is free software; you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# OpenFisca is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


"""Form controllers"""


from biryani1.baseconv import check, pipe
from formencode import variabledecode

from .. import auth, contexts, conv, model, questions, templates, wsgihelpers


@wsgihelpers.wsgify
def form(req):
    ctx = contexts.Ctx(req)
    auth.ensure_session(ctx)
    session = ctx.session
    page_data = req.urlvars['page_data']
    user_api_data = session.user.api_data if session.user is not None else None
    if user_api_data is None:
        user_api_data = {}
    # TODO remove this 'if'
    if page_data['slug'] in ['familles', 'declarations-impots', 'logements-principaux']:
        prenom_select_choices = questions.individus.build_prenom_select_choices(user_api_data)
        page_form = page_data['form_factory'](prenom_select_choices)
    else:
        legislation_urls_and_descriptions = (
            (legislation.get_api1_url(ctx, 'json'), legislation.title)
            for legislation in model.Legislation.find()
            )
        page_form = page_data['form_factory'](legislation_urls_and_descriptions)
    if req.method == 'GET':
        korma_values, korma_errors = pipe(
            page_data['api_data_to_page_korma_data'],
            page_form.root_data_to_str,
            )(user_api_data, state = ctx)
        page_form.fill(korma_values, korma_errors)
    else:
        params = req.params
        korma_inputs = variabledecode.variable_decode(params)
        korma_data, korma_errors = page_form.root_input_to_data(korma_inputs, state = ctx)
        if korma_errors is None:
            page_api_data = check(page_data['korma_data_to_page_api_data'](korma_data, state = ctx))
            if page_api_data is not None:
                user_api_data.update(page_api_data)
                session.user.api_data = user_api_data
                session.user.save(ctx, safe = True)
            return wsgihelpers.redirect(ctx, location = '')
        else:
            page_form.fill(korma_inputs, korma_errors)
    user_api_data['validate'] = True
    _, simulation_errors = conv.simulation.user_api_data_to_simulation_output(user_api_data, state = ctx)
    return templates.render(
        ctx,
        '/form.mako',
        korma_errors = korma_errors or {},
        page_form = page_form,
        simulation_errors = simulation_errors or {},
        )
